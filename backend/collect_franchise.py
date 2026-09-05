#!/usr/bin/env python3
"""
공정거래위원회 가맹사업 정보 수집기 → 프랜차이즈 브랜드·창업비용.

무엇을 채우나
-------------
지금 우리는 "프랜차이즈 비중이 몇 %" 까지만 안다(stores_by_industry.json).
정작 사장님이 묻는 것은 그 다음이다 — **"어느 브랜드가 얼마 드는가"**.
공정위 정보공개서는 브랜드마다 가맹금·보증금·교육비·기타비용을 공개하므로
그 질문에 실측으로 답할 수 있다.

덤으로 오래 못 풀던 문제 하나가 풀린다
--------------------------------------
서울시 상권분석의 프랜차이즈 점포수(FRC_STOR_CO)에 **직영점이 포함되는지**를
확인할 방법이 없었다. 공정위 '업종개황' 은 **직영점포수와 가맹점수를 따로** 주므로,
업종별 직영/가맹 비율을 독립적으로 알 수 있다. 서울시 수치와 대조하면 정의를 좁힐 수 있다.

⚠ 엔드포인트·필드명은 확인이 필요하다
--------------------------------------
공정위 가맹정보는 서비스가 여러 개이고(브랜드목록·업종개황·창업비용…) 오퍼레이션
이름이 서비스마다 다르다. 이 작업 환경에서는 data.go.kr 에 접속할 수 없어
**실제 응답으로 검증하지 못했다.** 그래서:
  · 요청 주소는 환경변수로 뺐다(아래 ENV). 활용신청 화면의 '요청주소'를 그대로 넣으면 된다.
  · 응답 필드는 흔한 이름들을 훑어 우리 모양으로 바꾼다(pick). 못 읽은 것은 버리지 않고
    raw 로 남겨 무엇이 왔는지 보이게 한다.
  · 파싱·집계 로직 자체는 `--selftest` 로 검증한다(네트워크 없이 돈다).

필요 환경변수
  DATA_GO_KR_KEY   (필수)  공공데이터포털 서비스키 — 건축물대장·상가정보와 **같은 키**.
                           단, 공정위 서비스도 따로 '활용신청' 승인이 필요하다.
  FTC_BRAND_URL    (선택)  브랜드 목록 요청주소
  FTC_INDUSTRY_URL (선택)  업종개황 요청주소(직영점/가맹점 수)
  FTC_COST_URL     (선택)  업종별 창업비용 요청주소

출력: frontend/franchise.json
  { available, updated, source,
    brands:[{name, corp, ind, open_cost:{total,franchise,deposit,edu,etc}}],
    industry:{ 업종명:{brands, direct, franchisee, direct_pct} },
    cost:{ 업종명:{deposit, edu, etc, total} } }

    python collect_franchise.py
    python collect_franchise.py --check      # 키·설정 확인만
    python collect_franchise.py --selftest   # 네트워크 없이 파싱 로직 검증
"""
import os, sys, json, datetime, urllib.request, urllib.parse
from collect_util import mark_unavailable

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "frontend", "franchise.json")

KEY = os.environ.get("DATA_GO_KR_KEY", "").strip()

# 확인된 것: 공정위 기관코드는 1130000, 브랜드 목록 서비스는 FftcBrandRlsInfo2_Service.
# 오퍼레이션 이름까지는 확인하지 못했으므로 환경변수로 덮어쓸 수 있게 둔다.
DEFAULTS = {
    "brand":    "https://apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service/getBrandList",
    "industry": "",   # 활용신청 화면의 요청주소를 FTC_INDUSTRY_URL 에 넣어야 동작
    "cost":     "",   # 마찬가지로 FTC_COST_URL
}
# GitHub Actions 는 미설정 vars 를 '빈 문자열'로 넘긴다. get(키, 기본값) 을 쓰면
# 빈 문자열이 기본값을 이겨서 주소가 사라진다 — `or` 로 받아야 한다.
URLS = {
    "brand":    (os.environ.get("FTC_BRAND_URL") or DEFAULTS["brand"]).strip(),
    "industry": (os.environ.get("FTC_INDUSTRY_URL") or DEFAULTS["industry"]).strip(),
    "cost":     (os.environ.get("FTC_COST_URL") or DEFAULTS["cost"]).strip(),
}

# 공공데이터포털 키는 Encoding(%2B…)·Decoding 두 형태. 어느 쪽을 넣어도 동작하게.
def enc_key(k):
    return k if "%" in k else urllib.parse.quote(k, safe="")


# ── 응답 필드 이름이 서비스마다 달라, 흔한 후보를 순서대로 훑는다 ──
FIELDS = {
    "brand_nm":  ["brandNm", "brand_nm", "brandName", "브랜드명"],
    "corp_nm":   ["hdoffceNm", "corpNm", "frcsHdqrtrNm", "가맹본부명", "법인명"],
    "ind_nm":    ["indutyNm", "indutyLclasNm", "업종명", "업종"],
    "direct":    ["drctMgmtStorCo", "directStoreCo", "직영점포수"],
    "franchisee":["frcsStorCo", "franchiseeCo", "가맹점수"],
    "brands_n":  ["brandCo", "brandCnt", "브랜드수"],
    "deposit":   ["gaipbojeungGgm", "bojeungGgm", "가맹보증금", "평균가맹보증금액"],
    "edu":       ["gyoyukbi", "eduAmt", "교육비", "평균가맹교육금액"],
    "etc":       ["gitaBi", "etcAmt", "기타비용", "평균가맹기타금액"],
    "franchise": ["gaipbi", "franchiseAmt", "가맹비", "평균가맹금액"],
}


def pick(row, key):
    """후보 이름을 순서대로 찾아 첫 값을 돌려준다. 없으면 None(지어내지 않는다)."""
    for n in FIELDS[key]:
        v = row.get(n)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
    return None


def num(v):
    """'1,000만원' · '10000' → 10000.0. 못 읽으면 None(0 으로 채우지 않는다)."""
    if v is None:
        return None
    s = str(v).replace(",", "").strip()
    keep = "".join(c for c in s if c.isdigit() or c == ".")
    try:
        return float(keep) if keep else None
    except ValueError:
        return None


def items_of(d):
    """기관마다 목록이 담기는 자리가 다르다. 흔한 자리를 훑는다(support.js 와 같은 방식)."""
    if isinstance(d, list):
        return d
    if not isinstance(d, dict):
        return []
    body = d.get("body") or (d.get("response") or {}).get("body") or d
    items = body.get("items") if isinstance(body, dict) else None
    if items is None:
        for k in ("data", "list", "resultList"):
            v = (body or {}).get(k) if isinstance(body, dict) else None
            if isinstance(v, list):
                return v
        return []
    if isinstance(items, dict):
        items = items.get("item", [])
    if isinstance(items, dict):
        items = [items]
    return items if isinstance(items, list) else []


def fetch(url, page=1, rows=1000):
    qs = urllib.parse.urlencode({"pageNo": page, "numOfRows": rows,
                                 "resultType": "json", "type": "json"})
    full = f"{url}?serviceKey={enc_key(KEY)}&{qs}"
    req = urllib.request.Request(full, headers={"User-Agent": "sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


# ── 파싱: 네트워크와 분리해 두어 --selftest 로 검증할 수 있다 ──
def parse_brands(raw_items):
    out = []
    for row in raw_items:
        nm = pick(row, "brand_nm")
        if not nm:
            continue
        cost = {k: num(pick(row, k)) for k in ("franchise", "deposit", "edu", "etc")}
        vals = [v for v in cost.values() if v is not None]
        rec = {"name": nm, "corp": pick(row, "corp_nm"), "ind": pick(row, "ind_nm")}
        if vals:
            cost["total"] = sum(vals)
            rec["open_cost"] = {k: v for k, v in cost.items() if v is not None}
        out.append(rec)
    return out


def parse_industry(raw_items):
    """업종별 브랜드수·직영점포수·가맹점수. 직영 비율까지 계산한다."""
    out = {}
    for row in raw_items:
        nm = pick(row, "ind_nm")
        if not nm:
            continue
        d, f = num(pick(row, "direct")), num(pick(row, "franchisee"))
        rec = {}
        if num(pick(row, "brands_n")) is not None:
            rec["brands"] = int(num(pick(row, "brands_n")))
        if d is not None:
            rec["direct"] = int(d)
        if f is not None:
            rec["franchisee"] = int(f)
        # 직영 비율 — 서울시 프랜차이즈 점포수 정의를 대조할 때 쓰는 값.
        if d is not None and f is not None and (d + f) > 0:
            rec["direct_pct"] = round(d / (d + f) * 100, 1)
        if rec:
            out[nm] = rec
    return out


def parse_cost(raw_items):
    out = {}
    for row in raw_items:
        nm = pick(row, "ind_nm")
        if not nm:
            continue
        rec = {k: num(pick(row, k)) for k in ("deposit", "edu", "etc", "franchise")}
        rec = {k: v for k, v in rec.items() if v is not None}
        if rec:
            rec["total"] = sum(rec.values())
            out[nm] = rec
    return out


def write_unavailable(reason):
    # 일시적 실패(키 만료·API 장애)로 멀쩡한 데이터를 지우지 않는다 — collect_util 참조.
    mark_unavailable(OUT, reason)



def selftest():
    """네트워크 없이 파싱·집계 로직만 검증한다. 응답 모양은 흔한 형태를 흉내낸 것."""
    fake = {"response": {"body": {"items": {"item": [
        {"brandNm": "테스트치킨", "hdoffceNm": "(주)테스트", "indutyNm": "치킨",
         "gaipbi": "10,000,000", "gaipbojeungGgm": "5,000,000",
         "gyoyukbi": "2,000,000", "gitaBi": "3,000,000"},
        {"brandNm": "값없는브랜드", "indutyNm": "카페"},
        {"corpNm": "이름없는행"},                       # brandNm 없음 → 버려야 함
    ]}}}}
    b = parse_brands(items_of(fake))
    assert len(b) == 2, b
    assert b[0]["open_cost"]["total"] == 20_000_000, b[0]
    assert "open_cost" not in b[1], b[1]

    ind = parse_industry([
        {"indutyNm": "치킨", "brandCo": "400", "drctMgmtStorCo": "120", "frcsStorCo": "24880"},
        {"indutyNm": "편의점", "drctMgmtStorCo": "8000", "frcsStorCo": "42000"},
        {"indutyNm": "값없음"},
    ])
    assert ind["치킨"]["direct_pct"] == 0.5, ind["치킨"]
    assert ind["편의점"]["direct_pct"] == 16.0, ind["편의점"]
    assert "값없음" not in ind

    c = parse_cost([{"indutyNm": "치킨", "평균가맹보증금액": "5000000", "평균가맹교육금액": "2000000"}])
    assert c["치킨"]["total"] == 7_000_000, c

    assert items_of({"body": {"items": [{"brandNm": "A"}]}}) == [{"brandNm": "A"}]
    assert items_of([{"brandNm": "A"}]) == [{"brandNm": "A"}]
    assert items_of({}) == []
    assert num("1,234원") == 1234.0 and num("") is None and num(None) is None

    print("selftest 통과 — 파싱·집계·결측 처리 정상")
    print(f"  브랜드 {len(b)}개 · 업종 {len(ind)}개 · 비용 {len(c)}개")
    print(f"  직영비율 예: 치킨 {ind['치킨']['direct_pct']}% · 편의점 {ind['편의점']['direct_pct']}%")
    return 0


def main():
    if "--selftest" in sys.argv:
        return selftest()
    if "--check" in sys.argv:
        print("DATA_GO_KR_KEY", "존재" if KEY else "없음")
        for k, u in URLS.items():
            print(f"  {k:9} {u or '(미설정 — 환경변수 필요)'}")
        return 0 if KEY else 1
    if not KEY:
        write_unavailable("DATA_GO_KR_KEY 없음 — 공공데이터포털 서비스키를 환경변수에 넣고 "
                          "공정위 가맹정보 서비스에 활용신청하세요.")
        return 0

    got, errs = {}, []
    parsers = {"brand": parse_brands, "industry": parse_industry, "cost": parse_cost}
    for kind, url in URLS.items():
        if not url:
            errs.append(f"{kind}: 요청주소 미설정")
            continue
        try:
            got[kind] = parsers[kind](items_of(fetch(url)))
            print(f"  {kind}: {len(got[kind])}건")
        except Exception as ex:
            # 원문에 serviceKey 가 들어 있을 수 있으므로 키는 지운 뒤 남긴다.
            msg = str(ex).replace(KEY, "***").replace(enc_key(KEY), "***")
            errs.append(f"{kind}: {msg[:120]}")
            print(f"  {kind} 실패: {msg[:120]}")

    if not got:
        write_unavailable("모든 요청 실패 — " + " / ".join(errs))
        return 0

    json.dump({
        "available": True,
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "source": "공정거래위원회 가맹사업 정보공개서(공공데이터포털)",
        "note": ("브랜드별 창업비용은 정보공개서 신고값이며 실제 계약 조건과 다를 수 있다. "
                 "industry 의 direct/franchisee 는 직영점·가맹점을 따로 센 값이다."),
        "partial": errs or None,
        "brands": got.get("brand", []),
        "industry": got.get("industry", {}),
        "cost": got.get("cost", {}),
    }, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print("저장:", OUT, f"· {os.path.getsize(OUT)/1024:.0f}KB")
    if errs:
        print("일부 미수집:", " / ".join(errs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
