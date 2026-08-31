#!/usr/bin/env python3
"""
상권 신호 엔진 — 변화 탐지 / 이상징후 / 다음 분기 전망.

하나의 엔진을 세 종류 시계열에 그대로 적용한다:
  - 업종(서울 전체)   : sales_history.json  … 지금 바로 있음
  - 상권 총매출        : zone_history.json   … 수집되면 자동 포함
  - 자치구 × 업종      : zone_history.json   … 수집되면 자동 포함
파일이 없으면 그 축은 조용히 빠진다(빈 값을 지어내지 않는다).

무엇을 계산하나
--------------
1) 변화(change)   QoQ(직전 분기 대비), YoY(작년 같은 분기 대비)
                  → 계절성이 큰 업종은 QoQ 가 착시라서 YoY 를 같이 본다.
2) 이상(anomaly)  중앙값·MAD 기반 로버스트 z-score.
                  평균·표준편차를 쓰면 이상치 자신이 평균을 끌어당겨 이상을 못 잡는다.
                  YoY 성장률 분포에서 최근 값이 얼마나 벗어났는지로 판정한다.
3) 전망(forecast) naive / seasonal / trend / damped 를 비교.
                  **홀드아웃 검증**: 마지막 HOLDOUT 분기는 학습에 절대 쓰지 않는다.

예측 검증 규칙 (이걸 안 지키면 예측은 사기다)
------------------------------------------
  - 시간 순서 분할. 미래 값을 과거 예측에 쓰지 않는다(누수 없음).
    각 시점 i 의 예측은 오직 series[:i] 만 본다.
  - 지표를 하나만 보지 않는다: MAE(평균 오차, 원), RMSE(큰 오차에 민감), MAPE(%).
  - 기준선(naive=직전 분기 그대로)을 이기지 못하면 **예측을 내보내지 않는다.**
    "관성보다 못한 예측"은 있으나 마나가 아니라 해롭다.
  - 데이터가 짧으면(MIN_LEN 미만) 아예 예측하지 않는다.
  - 통과한 것만 show=true. 화면은 show=false 를 표시하지 않는다.

출력: frontend/signals.json

    python build_signals.py
"""
import os, sys, json, math, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FE   = os.path.join(ROOT, "frontend")
OUT  = os.path.join(FE, "signals.json")

MIN_LEN   = 12    # 최소 12분기(3년) — 계절성을 보려면 최소 3주기는 필요
HOLDOUT   = 4     # 마지막 4분기(1년)는 검증 전용. 학습·선택에 절대 쓰지 않는다.
BEAT_MARGIN = 0.90  # 기준선 MAPE 의 90% 이하일 때만 채택(= 10% 이상 개선)
ANOM_Z    = 3.0   # 로버스트 z 이 이 값을 넘으면 '이상징후'(경보)
WATCH_Z   = 2.0   # 2.0~3.0 은 '주목'(참고). 임계를 하나만 두면 2.9 가 통째로 묻힌다.


def load(name):
    try:
        with open(os.path.join(FE, name), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


# ── 예측 방법들: 전부 series[:i] 만 본다(미래 참조 금지) ──
def m_naive(s, i):    return s[i-1] if i >= 1 else None
def m_seasonal(s, i): return s[i-4] if i >= 4 else None

def m_trend(s, i):
    """직전 4개 점에 직선을 맞춰 한 칸 앞을 외삽."""
    if i < 4: return None
    xs = list(range(i-4, i)); ys = s[i-4:i]
    n = len(xs); sx = sum(xs); sy = sum(ys)
    d = n*sum(x*x for x in xs) - sx*sx
    if d == 0: return ys[-1]
    b = (n*sum(x*y for x, y in zip(xs, ys)) - sx*sy) / d
    a = (sy - b*sx) / n
    return max(0.0, a + b*i)

def m_damped(s, i):
    """작년 같은 분기(계절) + 최근 추세의 절반. 추세를 그대로 믿으면 과하게 뻗어나가서
    한 번 꺾이면 크게 틀린다. 그래서 0.5 로 감쇠시킨다."""
    if i < 5: return None
    base = s[i-4]
    drift = (s[i-1] - s[i-5]) if i >= 5 else 0.0
    return max(0.0, base + 0.5*drift)

METHODS = {"naive": m_naive, "seasonal": m_seasonal, "trend": m_trend, "damped": m_damped}
METHOD_KO = {"naive": "직전 분기 유지", "seasonal": "작년 같은 분기",
             "trend": "최근 추세 외삽", "damped": "계절+감쇠추세"}


def score(series, fn, lo, hi):
    """구간 [lo,hi) 에서만 오차 집계. 예측은 항상 series[:i] 로만 만든다(누수 차단)."""
    ae, se, pe = [], [], []
    for i in range(lo, hi):
        p = fn(series, i)
        if p is None: continue
        a = series[i]
        ae.append(abs(p-a)); se.append((p-a)**2)
        if a: pe.append(abs(p-a)/abs(a))
    if not ae: return None
    return {"mae": sum(ae)/len(ae),
            "rmse": math.sqrt(sum(se)/len(se)),
            "mape": (sum(pe)/len(pe)*100) if pe else None,
            "n": len(ae)}


def median(a):
    a = sorted(a); n = len(a)
    if not n: return None
    return a[n//2] if n % 2 else (a[n//2-1] + a[n//2]) / 2.0


def analyze(series, quarters):
    """시계열 하나 → {change, anomaly, forecast}. 판단이 불가하면 해당 키를 비운다."""
    # 앞쪽 결측/0 은 '아직 집계 안 된 구간'이므로 잘라낸다.
    first = next((i for i, v in enumerate(series) if v), None)
    if first is None: return None
    s = [v for v in series[first:]]
    qs = quarters[first:]
    if any(v is None for v in s):          # 중간 결측은 보간하지 않는다(지어내기 금지)
        return {"skip": "중간 결측"}
    n = len(s)
    res = {"last_q": qs[-1], "last": round(s[-1])}

    # 1) 변화
    if n >= 2 and s[-2]:
        res["qoq"] = round((s[-1]/s[-2]-1)*100, 1)
    if n >= 5 and s[-5]:
        res["yoy"] = round((s[-1]/s[-5]-1)*100, 1)

    # 2) 이상징후 — YoY 성장률의 로버스트 z
    if n >= 9:
        g = [(s[i]/s[i-4]-1)*100 for i in range(4, n) if s[i-4]]
        if len(g) >= 5:
            med = median(g)
            mad = median([abs(x-med) for x in g]) or 0.0
            # 0.6745: MAD 를 정규분포 표준편차 스케일로 맞추는 상수
            sigma = mad/0.6745 if mad else 0.0
            if sigma > 0:
                z = (g[-1]-med)/sigma
                res["z"] = round(z, 2)
                # 2단계로 나눈다. 임계 하나만 두면 2.9 는 아무 말도 못 하고 3.0 은 경보가 된다.
                # 화면에서 '이상'은 빨강, '주목'은 회색으로 톤을 달리해 늑대소년을 피한다.
                if abs(z) >= ANOM_Z:
                    res["anomaly"] = "급등" if z > 0 else "급락"
                elif abs(z) >= WATCH_Z:
                    res["watch"] = "상승 주목" if z > 0 else "하락 주목"
                if res.get("anomaly") or res.get("watch"):
                    res["anomaly_detail"] = (f"최근 YoY {g[-1]:.1f}% — 이 계열의 평소 범위"
                                             f"({med:.1f}% ± {sigma:.1f}%p) 대비 {abs(z):.1f}배 벗어남")

    # 3) 전망 — 홀드아웃 검증
    if n >= MIN_LEN:
        split = n - HOLDOUT                     # [0,split) 학습·선택 / [split,n) 검증
        picks = {}
        for name, fn in METHODS.items():
            tr = score(s, fn, 5, split)         # 5부터: seasonal/damped 가 성립하는 최소 지점
            te = score(s, fn, split, n)
            if tr and te: picks[name] = (tr, te)
        base = picks.get("naive")
        if base:
            btr, bte = base
            # 학습구간에서 기준선을 충분히 이긴 방법만 후보. 그 다음 홀드아웃에서 재확인.
            cand = [(nm, v) for nm, v in picks.items()
                    if nm != "naive" and btr["mape"] and v[0]["mape"] and v[0]["mape"] <= btr["mape"]*BEAT_MARGIN]
            cand.sort(key=lambda x: x[1][0]["mape"])
            chosen, ok = None, False
            for nm, v in cand:
                if bte["mape"] and v[1]["mape"] and v[1]["mape"] < bte["mape"]:
                    chosen, ok = nm, True; break     # 홀드아웃에서도 이겼다
            if not chosen and cand:
                chosen = cand[0][0]                  # 학습만 이김 → 신뢰 부족으로 숨김
            fc = {
                "next_q": next_q(qs[-1]),
                "baseline_mape": round(bte["mape"], 1) if bte["mape"] else None,
                "show": False,
            }
            if chosen:
                tr, te = picks[chosen]
                fc.update({
                    "method": chosen, "method_ko": METHOD_KO[chosen],
                    "value": round(METHODS[chosen](s+[0], n) or 0),
                    "mae": round(te["mae"]), "rmse": round(te["rmse"]),
                    "mape": round(te["mape"], 1) if te["mape"] else None,
                    "holdout_n": te["n"], "train_n": tr["n"],
                    "show": bool(ok),
                    "reason": ("검증구간에서 기준선(직전 분기 유지)보다 오차가 낮음"
                               if ok else "학습구간만 개선 · 검증구간에서 기준선을 못 이겨 숨김"),
                })
            else:
                fc["reason"] = "어떤 방법도 기준선(직전 분기 유지)을 유의미하게 못 이김"
            res["forecast"] = fc
        elif n < MIN_LEN:
            res["forecast"] = {"show": False, "reason": f"분기 {n}개 — 최소 {MIN_LEN}개 필요"}
    else:
        res["forecast"] = {"show": False, "reason": f"분기 {n}개 — 최소 {MIN_LEN}개 필요"}
    return res


def next_q(q):
    y, qq = int(q[:4]), int(q[4]); qq += 1
    if qq > 4: y += 1; qq = 1
    return f"{y}{qq}"


def main():
    out = {"updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
           "params": {"min_len": MIN_LEN, "holdout": HOLDOUT,
                      "beat_margin": BEAT_MARGIN, "anom_z": ANOM_Z},
           "note": ("변화·이상·전망 신호. forecast.show=false 면 화면에 표시하지 않는다"
                    "(기준선을 못 이긴 예측). mae/rmse/mape 는 학습에 쓰지 않은 홀드아웃 구간 기준."),
           }
    stat = {"total": 0, "shown": 0, "anom": 0, "watch": 0}

    def run_axis(label, series_map, quarters):
        res = {}
        for k, arr in series_map.items():
            a = analyze(list(arr), quarters)
            if not a or a.get("skip"): continue
            res[k] = a
            stat["total"] += 1
            if a.get("forecast", {}).get("show"): stat["shown"] += 1
            if a.get("anomaly"): stat["anom"] += 1
            if a.get("watch"): stat["watch"] = stat.get("watch", 0) + 1
        print(f"  {label}: {len(res)}계열")
        return res

    hist = load("sales_history.json")
    if hist and hist.get("ind"):
        qs = hist["quarters"]
        out["ind"] = run_axis("업종(서울)", {nm: [m.get(q) for q in qs] for nm, m in hist["ind"].items()}, qs)
        out["quarters"] = qs

    zh = load("zone_history.json")
    if zh and zh.get("quarters"):
        zqs = zh["quarters"]
        out["zone_quarters"] = zqs
        if zh.get("zone"):
            out["zone"] = run_axis("상권 총매출", zh["zone"], zqs)
        if zh.get("gu_ind"):
            flat = {f"{g}|{nm}": arr for g, d in zh["gu_ind"].items() for nm, arr in d.items()}
            out["gu_ind"] = run_axis("자치구×업종", flat, zqs)
    else:
        out["zone_pending"] = "zone_history.json 미수집 — 다음 자동 수집(매월 2일) 후 상권/자치구 신호가 채워집니다."
        print("  상권 이력 없음 — 업종 축만 생성(정직).")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"저장: {OUT} · {os.path.getsize(OUT)/1024:.0f}KB")
    print(f"계열 {stat['total']} · 전망 표시 가능 {stat['shown']} · 이상징후 {stat['anom']} · 주목 {stat['watch']}")
    if stat["total"] and not stat["shown"]:
        print("→ 정직한 결론: 기준선을 이긴 예측이 없음. 화면엔 예측 대신 '변화'와 '손익분기'를 보여줄 것.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
