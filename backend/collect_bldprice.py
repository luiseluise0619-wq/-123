#!/usr/bin/env python3
"""
국토부 상업업무용 부동산 매매 실거래가 수집기 → 법정동별 ㎡당 자리값.

왜 필요한가 — 우리 데이터의 가장 큰 구멍
----------------------------------------
지금 임대료는 **서울을 네 권역(도심·강남·영등포신촌·기타)으로만** 안다(rent.json).
그런데 임대료는 손익 계산에서 가장 큰 고정비다. 상권 1,564곳을 구분해 놓고
정작 돈이 제일 많이 나가는 항목은 4칸으로 판단하고 있었다.

왜 임대료 실거래가는 아예 없는가
--------------------------------
제도가 없어서다. 주택은 「주택임대차보호법」 확정일자로 실거래가 쌓이지만
**상가 임대차는 신고 의무 자체가 없다.** 그래서 국가도 상가 임대료 실거래를
갖고 있지 않다. 서울시가 사람을 보내 직접 조사하는 이유가 이것이다.

그래서 이 수집기가 하는 일 — 실측과 추정을 확실히 가른다
--------------------------------------------------------
① **실측**: 근린생활시설 등 상업용 건물의 **㎡당 매매가 중위값**을 법정동별로 낸다.
   이건 신고된 실거래라 지어낸 값이 아니다. "이 동네 자리값이 비싼가"에 바로 답한다.
② **추정(선택)**: 연 소득수익률을 주면 월 임대료를 역산한다.
     월임대료(원/㎡) = ㎡당매매가 × 연수익률 ÷ 12
   이건 **추정**이므로 기본적으로 하지 않는다. BLDPRICE_YIELD 를 넣었을 때만
   계산하고, 결과에 est=True 와 쓴 수익률을 함께 적어 화면이 구분할 수 있게 한다.
   (수익률은 한국부동산원 상업용부동산 임대동향조사가 분기마다 공표한다.)

중위값을 쓰는 이유: 상업용 거래는 초고가 한 건이 평균을 통째로 끌어올린다.

⚠ 엔드포인트·필드명은 확인이 필요하다
--------------------------------------
이 작업 환경에서는 data.go.kr 에 접속할 수 없어 **실제 응답으로 검증하지 못했다.**
요청주소는 환경변수로 뺐고(활용신청 화면의 '요청주소'를 그대로 넣으면 된다),
응답 필드는 흔한 이름들을 훑는다. 파싱·집계 로직은 `--selftest` 로 검증한다.

필요 환경변수
  DATA_GO_KR_KEY    (필수)  건축물대장·상가정보와 **같은 키**. 단 이 서비스도 활용신청 필요.
  BLDPRICE_URL      (선택)  요청주소(기본값은 아래 DEFAULT_URL)
  BLDPRICE_MONTHS   (선택)  최근 몇 개월을 받을지(기본 12)
  BLDPRICE_YIELD    (선택)  연 소득수익률 %(예: 4.2). 넣으면 임대료 추정까지 한다.

출력: frontend/bld_price.json
  { available, updated, months, n_deals, source, note, yield_pct,
    dong:{ "<법정동명>":{ gu, n, med_per_m2, p25, p75, est_rent_m2? } } }

    python collect_bldprice.py
    python collect_bldprice.py --check
    python collect_bldprice.py --selftest
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "frontend", "bld_price.json")

KEY = os.environ.get("DATA_GO_KR_KEY", "").strip()
DEFAULT_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade"
# GitHub Actions 는 미설정 vars 를 '빈 문자열'로 넘긴다. get(키, 기본값) 을 쓰면
# 빈 문자열이 기본값을 이겨서 주소가 사라진다 — `or` 로 받아야 한다.
URL = (os.environ.get("BLDPRICE_URL") or DEFAULT_URL).strip()
MONTHS = max(1, min(36, int(os.environ.get("BLDPRICE_MONTHS", "12") or 12)))
YIELD = os.environ.get("BLDPRICE_YIELD", "").strip()

# 서울 25개 자치구 법정동코드 5자리(공개 표준코드) — collect_storeinfo.py 와 같은 표.
SIGUNGU = {
    "종로구": "11110", "중구": "11140", "용산구": "11170", "성동구": "11200", "광진구": "11215",
    "동대문구": "11230", "중랑구": "11260", "성북구": "11290", "강북구": "11305", "도봉구": "11320",
    "노원구": "11350", "은평구": "11380", "서대문구": "11410", "마포구": "11440", "양천구": "11470",
    "강서구": "11500", "구로구": "11530", "금천구": "11545", "영등포구": "11560", "동작구": "11590",
    "관악구": "11620", "서초구": "11650", "강남구": "11680", "송파구": "11710", "강동구": "11740",
}
CODE2GU = {v: k for k, v in SIGUNGU.items()}

# 상가로 쓰이는 용도만 남긴다. 공장·창고·교육연구까지 섞으면 '자리값'이 아니게 된다.
KEEP_USE = ("근린생활", "판매", "업무", "숙박")

FIELDS = {
    "dong":  ["법정동", "umdNm", "dongNm", "lawdNm"],
    "use":   ["건축물주용도", "buildingUse", "mainPurpsCdNm", "bldUse"],
    "area":  ["건물면적", "buildingAr", "excluUseAr", "plottageAr"],
    "amount": ["거래금액", "dealAmount", "dealAmt"],
    "year":  ["년", "dealYear"], "month": ["월", "dealMonth"],
}


def enc_key(k):
    return k if "%" in k else urllib.parse.quote(k, safe="")


def pick(row, key):
    for n in FIELDS[key]:
        v = row.get(n)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
    return None


def num(v):
    """'12,345' → 12345.0. 못 읽으면 None(0 으로 채우지 않는다)."""
    if v is None:
        return None
    s = "".join(c for c in str(v).replace(",", "").strip() if c.isdigit() or c == ".")
    try:
        return float(s) if s else None
    except ValueError:
        return None


def median(a):
    a = sorted(a)
    n = len(a)
    if not n:
        return None
    return a[n // 2] if n % 2 else (a[n // 2 - 1] + a[n // 2]) / 2.0


def quantile(a, q):
    """0~1 분위. 보간 없이 가장 가까운 순위값(건수가 적어 보간이 의미 없다)."""
    a = sorted(a)
    if not a:
        return None
    return a[min(len(a) - 1, max(0, int(round(q * (len(a) - 1)))))]


def rows_of(text):
    """응답이 XML 이든 JSON 이든 행 목록으로 만든다(서비스 버전마다 다르다)."""
    t = text.lstrip()
    if t.startswith("{") or t.startswith("["):
        d = json.loads(t)
        if isinstance(d, list):
            return d
        body = d.get("body") or (d.get("response") or {}).get("body") or d
        items = body.get("items") if isinstance(body, dict) else None
        if isinstance(items, dict):
            items = items.get("item", [])
        if isinstance(items, dict):
            items = [items]
        return items if isinstance(items, list) else []
    root = ET.fromstring(t)
    return [{c.tag: (c.text or "").strip() for c in it} for it in root.findall(".//item")]


def parse_deals(raw_rows, gu):
    """행 목록 → [(법정동, ㎡당 가격)]. 쓸 수 없는 행은 조용히 버린다."""
    out = []
    for r in raw_rows:
        use = pick(r, "use") or ""
        if KEEP_USE and not any(k in use for k in KEEP_USE):
            continue
        area = num(pick(r, "area"))
        amt = num(pick(r, "amount"))
        dong = pick(r, "dong")
        if not dong or not area or area <= 0 or not amt or amt <= 0:
            continue
        # 거래금액 단위는 '만원'이다(국토부 실거래 공통). 원 단위로 맞춘다.
        out.append((f"{gu} {dong}", amt * 10000 / area))
    return out


def aggregate(deals, yield_pct=None):
    """[(동, ㎡당가)] → 동별 중위·사분위. 거래가 너무 적은 동은 통계로 쓰지 않는다."""
    by = {}
    for dong, v in deals:
        by.setdefault(dong, []).append(v)
    out = {}
    for dong, vals in by.items():
        if len(vals) < 3:      # 1~2건은 그 동네 시세라고 부를 수 없다
            continue
        med = median(vals)
        rec = {"gu": dong.split(" ")[0], "n": len(vals),
               "med_per_m2": round(med), "p25": round(quantile(vals, 0.25)),
               "p75": round(quantile(vals, 0.75))}
        if yield_pct:
            # 추정이다 — 실측 매매가에 가정한 수익률을 곱한 값.
            rec["est_rent_m2"] = round(med * (yield_pct / 100.0) / 12)
        out[dong] = rec
    return out


def fetch(lawd, ymd, page=1, rows=1000):
    qs = urllib.parse.urlencode({"LAWD_CD": lawd, "DEAL_YMD": ymd,
                                 "pageNo": page, "numOfRows": rows})
    full = f"{URL}?serviceKey={enc_key(KEY)}&{qs}"
    req = urllib.request.Request(full, headers={"User-Agent": "sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def recent_months(n):
    d = datetime.date.today().replace(day=1)
    out = []
    for _ in range(n):
        d = (d - datetime.timedelta(days=1)).replace(day=1)
        out.append(d.strftime("%Y%m"))
    return out


def write_unavailable(reason):
    json.dump({"available": False, "reason": reason,
               "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d")},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print("available=false:", reason)


def selftest():
    xml = """<response><body><items>
      <item><법정동>역삼동</법정동><건축물주용도>제2종근린생활시설</건축물주용도>
            <건물면적>100</건물면적><거래금액>100,000</거래금액></item>
      <item><법정동>역삼동</법정동><건축물주용도>제1종근린생활시설</건축물주용도>
            <건물면적>50</건물면적><거래금액>60,000</거래금액></item>
      <item><법정동>역삼동</법정동><건축물주용도>업무시설</건축물주용도>
            <건물면적>200</건물면적><거래금액>300,000</거래금액></item>
      <item><법정동>역삼동</법정동><건축물주용도>공장</건축물주용도>
            <건물면적>100</건물면적><거래금액>10</거래금액></item>
      <item><법정동>논현동</법정동><건축물주용도>제2종근린생활시설</건축물주용도>
            <건물면적>0</건물면적><거래금액>50,000</거래금액></item>
    </items></body></response>"""
    rows = rows_of(xml)
    assert len(rows) == 5, len(rows)
    deals = parse_deals(rows, "강남구")
    # 공장 제외 + 면적 0 제외 → 3건만 남아야 한다
    assert len(deals) == 3, deals
    # 100,000만원 / 100㎡ = 1,000만원/㎡ = 10,000,000원
    assert abs(deals[0][1] - 10_000_000) < 1, deals[0]

    agg = aggregate(deals)
    assert "강남구 역삼동" in agg and agg["강남구 역삼동"]["n"] == 3, agg
    assert agg["강남구 역삼동"]["med_per_m2"] == 12_000_000, agg   # 10M/12M/15M 의 중위
    assert "강남구 논현동" not in agg                                # 3건 미만 → 제외

    a2 = aggregate(deals, yield_pct=4.2)
    assert a2["강남구 역삼동"]["est_rent_m2"] == round(12_000_000 * 0.042 / 12), a2
    assert "est_rent_m2" not in agg["강남구 역삼동"]                 # 수익률 없으면 추정 안 함

    j = rows_of('{"response":{"body":{"items":{"item":[{"법정동":"삼성동"}]}}}}')
    assert j == [{"법정동": "삼성동"}], j
    assert rows_of("{}") == [] and median([]) is None and num("") is None

    print("selftest 통과 — 용도 필터·면적0 제외·중위·분위·추정 분리 정상")
    print(f"  역삼동 {agg['강남구 역삼동']['n']}건 · 중위 {agg['강남구 역삼동']['med_per_m2']:,}원/㎡")
    print(f"  수익률 4.2% 가정 시 추정 임대료 {a2['강남구 역삼동']['est_rent_m2']:,}원/㎡·월")
    print("  ※ 거래 3건 미만인 동(논현동)은 시세로 쓰지 않고 제외 — 확인됨")
    return 0


def main():
    if "--selftest" in sys.argv:
        return selftest()
    if "--check" in sys.argv:
        print("DATA_GO_KR_KEY", "존재" if KEY else "없음")
        print("  요청주소:", URL)
        print("  기간:", MONTHS, "개월 · 수익률:", YIELD or "(미설정 — 추정 안 함)")
        return 0 if KEY else 1
    if not KEY:
        write_unavailable("DATA_GO_KR_KEY 없음 — 국토부 상업업무용 매매 실거래가 활용신청이 필요합니다.")
        return 0

    y = None
    if YIELD:
        try:
            y = float(YIELD)
        except ValueError:
            print("BLDPRICE_YIELD 를 숫자로 읽지 못했습니다 — 추정 없이 진행합니다.")

    months = recent_months(MONTHS)
    deals, fails = [], 0
    for gu, code in SIGUNGU.items():
        got = 0
        for ymd in months:
            try:
                deals_m = parse_deals(rows_of(fetch(code, ymd)), gu)
                deals.extend(deals_m); got += len(deals_m)
            except Exception as ex:
                fails += 1
                if fails <= 3:
                    msg = str(ex).replace(KEY, "***").replace(enc_key(KEY), "***")
                    print(f"  {gu} {ymd} 실패: {msg[:100]}")
            time.sleep(0.1)
        print(f"  {gu}: {got}건")

    if not deals:
        write_unavailable(f"거래를 한 건도 받지 못했습니다(실패 {fails}회). "
                          "요청주소·활용신청 승인 상태를 확인하세요.")
        return 0

    dong = aggregate(deals, y)
    json.dump({
        "available": True,
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "source": "국토교통부 상업업무용 부동산 매매 실거래가",
        "months": months, "n_deals": len(deals),
        "yield_pct": y,
        "note": ("med_per_m2 는 신고된 실거래 기준 ㎡당 매매가 중위값(실측). "
                 "est_rent_m2 는 그 값에 가정한 연 소득수익률을 적용해 되짚은 "
                 "월 임대료 **추정치**이며 실거래가 아니다. "
                 "거래 3건 미만인 법정동은 시세로 보지 않고 제외했다."),
        "dong": dong,
    }, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · 법정동 {len(dong)}곳 · 거래 {len(deals):,}건"
          + (f" · 추정 수익률 {y}%" if y else " · 추정 없음(실측만)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
