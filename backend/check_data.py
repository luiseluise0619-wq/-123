#!/usr/bin/env python3
"""
데이터 무결성 자동 점검기 — frontend/*.json 의 값이 상식 범위에 있는지 검사한다.

왜: 서울 열린데이터 서비스는 특정 분기에 카테고리 집계가 깨지는 일이 있다(예: 2026 1분기
소비-자치구에서 여가·문화가 소비의 96%로 나온 사례). '최신 분기 무조건 사용' 수집기는
그런 깨진 값을 그대로 받는다. 이 점검기는 분기 갱신 후 이상치를 조기에 잡기 위한 안전망이다.

원칙(정직): 정상 데이터를 함부로 버리지 않는다 — 여기서는 '검사·경고'만 하고 데이터를
고치거나 지우지 않는다. FAIL 이 있으면 로그로 눈에 띄게 남기고 종료코드로 알린다.

    python check_data.py            # 전체 점검, 리포트 출력
    python check_data.py --strict   # FAIL 있으면 종료코드 1 (CI 게이트용)

검사 항목(파일 없으면 '건너뜀' — 해당 파이프라인이 아직 안 돌았을 수 있으므로 실패로 치지 않음):
  - 비율 배열(시간대·요일·연령·성별·연령구성) 합이 100±3
  - 소비 구성: 각 자치구 합 100±2, 생활필수(식료품·음식·의료비·교통)≥40%, 단일항목≤55%
  - 매출 객단가>0, 점포 폐업률 0~20%, 아파트 시가≥0, 상권 생존개월 0~600
  - 임대료 서울 평균 1~30 만원/㎡, 생활인구 자치구 합 500만~1500만
"""
import os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FE = os.path.join(ROOT, "frontend")

fails, warns, oks, skips = [], [], [], []
def FAIL(f, m): fails.append(f"[FAIL] {f}: {m}")
def WARN(f, m): warns.append(f"[WARN] {f}: {m}")
def OK(f, m):   oks.append(f"[ ok ] {f}: {m}")
def SKIP(f, m): skips.append(f"[skip] {f}: {m}")

def load(name):
    p = os.path.join(FE, name)
    if not os.path.exists(p):
        return None, "파일 없음"
    try:
        return json.load(open(p, encoding="utf-8")), None
    except Exception as e:
        return None, f"JSON 파싱 실패: {e}"

def sum_ok(arr, target=100, tol=3):
    try: return abs(sum(arr) - target) <= tol
    except: return False

# ── 매출: 분포 배열 합 100, 객단가>0 ──
def check_sales():
    d, err = load("sales_by_industry.json")
    if d is None: return SKIP("sales_by_industry", err)
    ind = d.get("ind") or {}
    if not ind: return WARN("sales_by_industry", "ind 비어있음")
    bad = []
    for k, v in ind.items():
        for field in ("tmzon", "dow", "age", "gender"):
            a = v.get(field)
            if isinstance(a, list) and not sum_ok(a):
                bad.append(f"{k}.{field}={sum(a):.0f}")
        if v.get("unit") is not None and v["unit"] <= 0:
            bad.append(f"{k}.unit={v['unit']}")
    if bad: FAIL("sales_by_industry", f"분포/객단가 이상 {len(bad)}건 " + str(bad[:5]))
    else: OK("sales_by_industry", f"{len(ind)}개 업종 분포합·객단가 정상")

# ── 점포: 폐업률/개업률 범위 ──
def check_stores():
    d, err = load("stores_by_industry.json")
    if d is None: return SKIP("stores_by_industry", err)
    ind = d.get("ind") or {}
    if not ind: return WARN("stores_by_industry", "ind 비어있음")
    bad = [f"{k}={v.get('close_rate')}" for k, v in ind.items()
           if isinstance(v.get("close_rate"), (int, float)) and not (0 <= v["close_rate"] <= 20)]
    if bad: FAIL("stores_by_industry", f"폐업률 범위 이상 {len(bad)}건 " + str(bad[:5]))
    else: OK("stores_by_industry", f"{len(ind)}개 업종 폐업률 정상")

# ── 소비: 자치구별 구성비 무결성 ──
def check_income():
    d, err = load("income.json")
    if d is None: return SKIP("income", err)
    if d.get("available") is False: return WARN("income", f"available=false ({d.get('reason','')})")
    ESS = ("식료품", "음식", "의료비", "교통")
    def bad_spend(sp):
        tot = sum(s["pct"] for s in sp)
        if abs(tot - 100) > 2: return f"합={tot:.0f}"
        ess = sum(s["pct"] for s in sp if s["name"] in ESS)
        if ess / (tot or 1) < 0.40: return f"필수={ess:.0f}%"
        mx = max(s["pct"] for s in sp)
        if mx / (tot or 1) > 0.55: return f"최대항목={mx:.0f}%"
        return None
    gu = d.get("gu") or {}
    bad = {g: bad_spend(v["spend"]) for g, v in gu.items() if v.get("spend") and bad_spend(v["spend"])}
    seoul_bad = bad_spend(d["spend"]) if d.get("spend") else "spend 없음"
    if seoul_bad: FAIL("income", f"서울 전체 소비 이상({seoul_bad})")
    if bad: WARN("income", f"자치구 {len(bad)}개 소비 이상(가드로 화면엔 폴백): " + str(dict(list(bad.items())[:4])))
    if not seoul_bad and not bad: OK("income", f"서울+자치구 {len(gu)}개 소비 구성비 정상")
    elif not seoul_bad: OK("income", "서울 전체 소비 정상(자치구 일부 폴백)")

# ── 상권변화: 생존개월 범위 ──
def check_zone_change():
    d, err = load("zone_change.json")
    if d is None: return SKIP("zone_change", err)
    z = d.get("zones") or {}
    bad = [k for k, v in z.items() if not (0 <= v.get("opr", 0) <= 600)]
    if bad: FAIL("zone_change", f"생존개월 범위 이상 {len(bad)}건")
    else: OK("zone_change", f"{len(z)}개 상권 생존개월 정상")

# ── 아파트: 시가 음수 없음 ──
def check_zone_apt():
    d, err = load("zone_apt.json")
    if d is None: return SKIP("zone_apt", err)
    z = d.get("zones") or {}
    bad = [k for k, v in z.items() if v.get("price_eok", 0) < 0 or v.get("hshld", 0) < 0]
    if bad: FAIL("zone_apt", f"시가/세대 음수 {len(bad)}건")
    else: OK("zone_apt", f"{len(z)}개 상권 아파트 값 정상")

# ── 인구: 연령 구성비 합 100 ──
def check_pop():
    for name in ("repop", "workpop"):
        d, err = load(name + ".json")
        if d is None: SKIP(name, err); continue
        ap = d.get("age_pct")
        if isinstance(ap, list) and not sum_ok(ap):
            FAIL(name, f"연령구성 합={sum(ap):.0f}")
        else:
            OK(name, f"연령구성 정상 (기준분기 {d.get('quarter')})")

# ── 임대료: 서울 평균 범위 ──
def check_rent():
    d, err = load("rent.json")
    if d is None: return SKIP("rent", err)
    s = d.get("seoul") or {}
    r = s.get("rent")
    if r is None: return WARN("rent", "seoul.rent 없음")
    if not (1 <= r <= 30): FAIL("rent", f"서울 평균 임대료 {r} 만원/㎡ 범위 이상(1~30)")
    else: OK("rent", f"서울 임대료 {r} 만원/㎡ 정상")

# ── 생활인구: 자치구 체류 합 범위 ──
def check_livepop():
    d, err = load("livepop_gu.json")
    if d is None: return SKIP("livepop_gu", err)
    gu = d.get("gu") or {}
    tot = sum(v.get("tot", 0) for v in gu.values())
    if not (5_000_000 <= tot <= 15_000_000):
        WARN("livepop_gu", f"자치구 체류 합 {tot:,.0f} (예상 500만~1500만)")
    else:
        OK("livepop_gu", f"자치구 {len(gu)}개 체류 합 {tot:,.0f} 정상")

def main():
    for fn in (check_sales, check_stores, check_income, check_zone_change,
               check_zone_apt, check_pop, check_rent, check_livepop):
        try: fn()
        except Exception as e: FAIL(fn.__name__, f"점검 중 예외: {e}")

    print("=" * 60)
    print(" 데이터 무결성 점검 리포트")
    print("=" * 60)
    for line in oks + warns + fails + skips:
        print(" " + line)
    print("-" * 60)
    print(f" 정상 {len(oks)} · 경고 {len(warns)} · 실패 {len(fails)} · 건너뜀 {len(skips)}")
    if fails:
        print(" ⚠️ 실패 항목이 있습니다 — 최신 분기 데이터가 깨졌을 수 있습니다.")
    if "--strict" in sys.argv and fails:
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
