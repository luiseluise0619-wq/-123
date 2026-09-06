#!/usr/bin/env python3
"""
수집 결과 요약 — 워크플로 마지막에 "무엇이 갱신됐고 무엇이 비었는지" 한 장으로 알린다.

왜 필요한가
-----------
refresh-dashboard.yml 의 수집 단계는 전부 `continue-on-error: true` 다.
API 키가 만료되든 공공 API 가 죽든 워크플로는 초록색으로 끝난다. 그래서 로그에서
"변경 없음 — 커밋 생략"과 "전부 실패해서 만든 게 없음"이 구분되지 않는다.
수집이 조용히 멈춰도 몇 주 동안 아무도 모를 수 있다.

이 스크립트는 산출 파일을 직접 읽어 상태를 판정한다. 단계의 성공/실패가 아니라
**파일이 실제로 뭘 담고 있는지**를 본다 — 수집기는 키가 없으면 성공으로 끝내면서
available:false 를 쓰기 때문에, 단계 결과만 봐서는 알 수 없다.

무엇을 하나
-----------
· GitHub Actions 실행 페이지에 표(작업 요약)를 남긴다.
· 문제 있는 파일마다 ::warning:: 주석을 달아 UI 에 뜨게 한다.
· **수치 파일이 전부 죽었을 때만** exit 1 로 실패시킨다(그때는 GitHub 이 메일을 보낸다).
  부분 실패로는 막지 않는다 — 승인 대기 중인 선택 항목까지 매주 빨간불이 되면
  아무도 안 보게 된다.

분류
----
수치  분기마다 갱신돼야 하는 것. 오래되면 경고.
지리  자치구 경계·좌표처럼 의도적으로 보존하는 것. 오래된 게 정상이라 검사하지 않는다.
선택  활용신청 승인 전이라 비어 있는 게 정상인 것. 비어 있어도 경고만.

    python report_freshness.py
"""
import os, sys, json, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FE   = os.path.join(ROOT, "frontend")

# 분기마다 갱신돼야 하는 것 — 오래되거나 비면 경고, 전부 죽으면 실패.
NUMERIC = [
    ("data/v3/zone_industry.json",     "상권×업종 매출·점포 (화면의 뼈대)"),
    ("data/v3/sales_by_industry.json", "업종별 매출 패턴"),
    ("data/v3/stores_by_industry.json","업종별 점포 수"),
    ("data/v3/sales_history.json",     "매출 시계열 (전망 계산의 입력)"),
    ("data/v3/income.json",            "자치구 소득·소비"),
    ("data/v3/rent.json",              "권역 임대료"),
    ("livepop_gu.json",                "자치구 생활인구"),
    ("livepop_dong.json",              "행정동 생활인구"),
    ("subway_gu.json",                 "지하철 승하차"),
    ("parking_gu.json",                "주차장"),
    ("storeinfo_gu.json",              "자치구 상가 총수"),
    ("workpop.json",                   "상권 직장인구"),
    ("repop.json",                     "상권 상주인구"),
    ("zone_change.json",               "상권 변화지표"),
    ("zone_facility.json",             "상권 집객시설"),
    ("zone_apt.json",                  "상권 아파트"),
    ("signals.json",                   "상권 신호·전망"),
]

# 의도적으로 보존하는 지리 — 분기마다 안 바뀌는 게 맞다. 존재만 확인한다.
GEO = [
    ("data/v3/seoul_map.json",   "자치구 지도 경로"),
    ("data/v3/zone_border.json", "자치구 경계"),
    ("data/v3/zone_gu.json",     "상권→자치구 배정"),
    ("data/v3/zone_livepop.json","상권 유동인구"),
]

# 활용신청 승인 전이라 비어 있는 게 정상. 경고만 한다.
OPTIONAL = [
    ("franchise.json", "공정위 가맹정보 — data.go.kr 활용신청 대기"),
    ("bld_price.json", "국토부 실거래가 — data.go.kr 활용신청 대기"),
]

STALE_DAYS = 45   # 주간 실행 + 월간 heavy 를 감안한 여유. 이보다 오래되면 갱신이 멈춘 것으로 본다.


def read(rel):
    """(상태, 상세) 를 돌려준다. 상태: ok / empty / missing / broken"""
    p = os.path.join(FE, rel)
    if not os.path.exists(p):
        return "missing", {}
    try:
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
    except Exception as e:
        return "broken", {"reason": str(e)[:80]}
    info = {"size": os.path.getsize(p)}
    if isinstance(d, dict):
        info["updated"] = d.get("updated")
        info["reason"] = d.get("reason")
        if d.get("available") is False:
            return "empty", info
    return "ok", info


def age_days(updated):
    """updated(YYYY-MM-DD) 가 며칠 전인지. 못 읽으면 None(모른다고 답한다)."""
    if not updated:
        return None
    try:
        d = datetime.datetime.strptime(str(updated)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None
    return (datetime.date.today() - d).days


def kb(n):
    # 서울 전체 합계만 담는 파일은 몇백 바이트가 정상이다(workpop·repop 등).
    # 그걸 '0KB'로 적으면 비어 있는 것처럼 읽힌다.
    if not n:
        return "—"
    return f"{n/1024:.0f}KB" if n >= 1024 else f"{n}B"


def main():
    lines = ["## 수집 결과", "", "| 상태 | 데이터 | 갱신일 | 크기 | 비고 |", "|---|---|---|---|---|"]
    warns = []
    n_ok = 0

    for rel, label in NUMERIC:
        st, info = read(rel)
        up = info.get("updated")
        age = age_days(up)
        note = ""
        if st == "ok" and age is not None and age > STALE_DAYS:
            st, note = "stale", f"{age}일째 그대로"
        if st == "ok":
            n_ok += 1
            icon = "✅"
        elif st == "stale":
            icon = "🟡"; warns.append(f"{label}({rel}) — {note}")
        elif st == "empty":
            icon = "🟡"; note = (info.get("reason") or "available:false")[:60]
            warns.append(f"{label}({rel}) — 비어 있음: {note}")
        elif st == "missing":
            icon = "❌"; note = "파일 없음"
            warns.append(f"{label}({rel}) — 파일이 만들어지지 않았다")
        else:
            icon = "❌"; note = "JSON 깨짐: " + (info.get("reason") or "")
            warns.append(f"{label}({rel}) — {note}")
        lines.append(f"| {icon} | {label} | {up or '—'} | {kb(info.get('size'))} | {note} |")

    lines += ["", "### 보존 (분기마다 안 바뀌는 게 정상)", "",
              "| 상태 | 데이터 | 크기 |", "|---|---|---|"]
    for rel, label in GEO:
        st, info = read(rel)
        icon = "✅" if st == "ok" else "❌"
        if st != "ok":
            warns.append(f"{label}({rel}) — {st}")
        lines.append(f"| {icon} | {label} | {kb(info.get('size'))} |")

    lines += ["", "### 승인 대기 (비어 있는 게 정상)", "",
              "| 상태 | 데이터 |", "|---|---|"]
    for rel, label in OPTIONAL:
        st, _ = read(rel)
        lines.append(f"| {'✅' if st == 'ok' else '⏸'} | {label} |")

    total = len(NUMERIC)
    lines += ["", f"**수치 {n_ok}/{total} 정상**"]
    if warns:
        lines += ["", "### 확인 필요", ""] + [f"- {w}" for w in warns]

    report = "\n".join(lines)
    print(report)

    # 실행 페이지에 표로 남긴다.
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(report + "\n")

    # UI 주석 — 로그를 안 펼쳐도 보이게.
    for w in warns:
        print(f"::warning::{w}")

    # 전면 붕괴일 때만 실패시킨다. 그래야 GitHub 이 메일을 보낸다.
    # 부분 실패로 매주 빨간불이 되면 아무도 안 보게 되므로 막지 않는다.
    if n_ok == 0:
        print("::error::수집이 전부 실패했다 — 갱신된 수치 데이터가 하나도 없다. "
              "API 키 만료나 공공 API 장애를 먼저 확인할 것.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
