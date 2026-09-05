#!/usr/bin/env python3
"""
서울 상권분석 소비-자치구(VwsmSignguNcmCnsmpW) → 자치구별 소비 지출 구성 + 서울 전체 합계.

왜 이 서비스인가:
- 서울시가 '월 평균 소득 금액'을 2020년 수급 중단 → 2026-05-13 삭제해 '소득'은 더 이상 없다(income_avg=null).
- 상권(trdarNcmCnsmp) 서비스는 표준단위구역 전환 중이라 빈 행이 많다.
- 반면 소비-자치구(VwsmSignguNcmCnsmpW)는 25개 자치구가 빠짐없이 채워져 있어 '어디에 돈을 쓰나'를 정확히 보여준다.

정직 원칙:
- 지출 '절대 금액'은 자치구마다 규모가 달라 그대로 비교하면 오해 → '구성비(%)'로만 저장/표시한다.
- 소득은 원본이 없어 null 로 두고, 지어내지 않는다.

출력: frontend/income.json
  {
    service, quarter(대표=최신), updated, available,
    income_avg: null, income_note,          # 소득은 원본 종료
    spend: [ {name, pct}, ... ],            # 서울 전체 합계 구성비(하위호환)
    gu: { "강남구": { quarter, spend:[{name,pct}] }, ... }   # 자치구별 구성비
  }

    python collect_income.py           # 수집·집계·저장
    python collect_income.py --check   # 키 존재 여부만 확인
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from collect_util import mark_unavailable

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "income.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "VwsmSignguNcmCnsmpW"      # 소득소비-자치구(소비만 제공, 소득 컬럼은 폐지)
BASE = "http://openapi.seoul.go.kr:8088"

# 지출 카테고리(표시명, 자치구 서비스의 표준 필드). EXPNDTR_TOTAMT = 아래 10개 합계(검증됨).
SPEND = [
    ("식료품",    "FDSTFFS_EXPNDTR_TOTAMT"),
    ("음식",      "FD_EXPNDTR_TOTAMT"),          # 외식 등 음식 지출
    ("의료비",    "MCP_EXPNDTR_TOTAMT"),
    ("교통",      "TRNSPORT_EXPNDTR_TOTAMT"),
    ("교육",      "EDC_EXPNDTR_TOTAMT"),
    ("여가·문화", "LSR_CLTUR_EXPNDTR_TOTAMT"),   # 자치구 서비스는 여가+문화 합산 필드
    ("의류·신발", "CLTHS_FTWR_EXPNDTR_TOTAMT"),
    ("생활용품",  "LVSPL_EXPNDTR_TOTAMT"),
    ("유흥",      "PLESR_EXPNDTR_TOTAMT"),
    ("기타",      "ETC_EXPNDTR_TOTAMT"),
]

def fnum(x):
    try: return float(x)
    except: return 0.0

def fetch(start, end):
    url = f"{BASE}/{urllib.parse.quote(KEY)}/xml/{SERVICE}/{start}/{end}/"
    req = urllib.request.Request(url, headers={"User-Agent": "sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8")

def write_unavailable(reason):
    # 일시적 실패(키 만료·API 장애)로 멀쩡한 데이터를 지우지 않는다 — collect_util 참조.
    mark_unavailable(OUT, reason)


def pct_list(amounts):
    """카테고리 금액 dict → [{name,pct}] (합계 100%). 합이 0이면 None."""
    tot = sum(amounts.values())
    if tot <= 0:
        return None
    return [{"name": n, "pct": round(100 * amounts[n] / tot, 1)} for n, _ in SPEND]

def main():
    if not KEY:
        print("SEOUL_API_KEY 없음 — 수집 생략(정직).")
        if "--check" not in sys.argv: write_unavailable("SEOUL_API_KEY 없음")
        return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("SEOUL_API_KEY 존재 — 수집 가능"); return 0

    # 총 건수 확인
    try:
        head = ET.fromstring(fetch(1, 1))
    except Exception as e:
        write_unavailable(f"첫 요청 실패: {e}"); return 2
    if head.findtext(".//RESULT/CODE") != "INFO-000":
        write_unavailable("RESULT 코드 비정상 — " + (head.findtext(".//RESULT/MESSAGE") or "")); return 2
    total = int(head.findtext(".//list_total_count") or 0)
    if total <= 0:
        write_unavailable("list_total_count=0"); return 2
    print(f"서비스 {SERVICE} · 총 {total:,}행")

    # 자치구별 '최신 분기' 행만 남긴다(응답이 분기 섞여 오므로 max STDR_YYQU_CD 유지).
    # 자치구별로 '모든 분기'를 모은다(최신 분기만 쓰면 깨진 분기를 그대로 받게 됨).
    byq = {}   # 자치구명 → { 분기: {카테고리: 금액} }
    step = 1000
    for s in range(1, total + 1, step):
        e = min(s + step - 1, total)
        for attempt in range(4):
            try: xml = fetch(s, e); break
            except Exception:
                if attempt == 3: raise
                time.sleep(2 * (attempt + 1))
        for row in ET.fromstring(xml).findall(".//row"):
            gu = (row.findtext("SIGNGU_CD_NM") or "").strip()
            qu = (row.findtext("STDR_YYQU_CD") or "").strip()
            if not gu or not qu:
                continue
            amounts = {n: fnum(row.findtext(k)) for n, k in SPEND}
            if sum(amounts.values()) <= 0:
                continue   # 빈 행 스킵(지어내지 않음)
            byq.setdefault(gu, {})[qu] = amounts
        time.sleep(0.12)

    # 완전성 검사: 특정 분기에서 카테고리 집계가 깨져 한 항목(예: 여가·문화)이
    # 소비 대부분을 차지하는 경우가 있다(2026 1분기 일부 자치구). 생활 필수 지출
    # (식료품·음식·의료비·교통) 합이 40% 미만이면 '깨진 분기'로 보고, 그 자치구는
    # 필수 지출 비중이 정상인 '가장 최신 분기'로 대체한다. 정상 분기가 없으면 그 자치구는 뺀다.
    ESSENTIALS = ("식료품", "음식", "의료비", "교통")
    def ok(amounts):
        tot = sum(amounts.values())
        if tot <= 0:
            return False
        ess = sum(amounts.get(n, 0.0) for n in ESSENTIALS)
        # 필수 지출이 40% 이상이고, 단일 항목이 50%를 넘지 않아야 '완전'로 본다.
        return (ess / tot) >= 0.40 and (max(amounts.values()) / tot) <= 0.50
    latest = {}   # 자치구명 → (분기, {카테고리: 금액})
    dropped = []
    for gu, qmap in byq.items():
        for qu in sorted(qmap.keys(), reverse=True):   # 최신 분기부터
            if ok(qmap[qu]):
                latest[gu] = (qu, qmap[qu]); break
        if gu not in latest:
            dropped.append(gu)
    if dropped:
        print("완전한 분기 없어 제외된 자치구:", ", ".join(dropped))

    if not latest:
        write_unavailable("완전한 자치구 소비 데이터 0 — 모든 분기에서 카테고리 집계 이상"); return 3

    # 자치구별 구성비 + 서울 전체 합계 구성비
    gu_out = {}
    seoul_amt = {n: 0.0 for n, _ in SPEND}
    rep_quarter = ""
    for gu, (qu, amounts) in latest.items():
        pl = pct_list(amounts)
        if pl is None:
            continue
        gu_out[gu] = {"quarter": qu, "spend": pl}
        for n, _ in SPEND:
            seoul_amt[n] += amounts[n]
        if qu > rep_quarter:
            rep_quarter = qu

    out = {
        "service": SERVICE,
        "quarter": rep_quarter,
        "available": True,
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "income_avg": None,   # 서울시 '월 평균 소득' 원본 종료(2026-05) → 없음. 지어내지 않는다.
        "income_note": "서울시가 '월 평균 소득 금액'을 2020년 수급 중단·2026-05-13 삭제해 소득은 제공하지 않습니다. 자치구별 소득은 국세청·국민연금 통계가 대체 자료입니다.",
        "spend": pct_list(seoul_amt),   # 서울 전체 합계 구성비(하위호환)
        "gu": gu_out,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · 자치구 {len(gu_out)}개 · 대표분기 {rep_quarter}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
