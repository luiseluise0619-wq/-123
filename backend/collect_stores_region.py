#!/usr/bin/env python3
"""
소상공인시장진흥공단 상가(상권)정보 → 시·도별 '시군구별 업종 점포 수' 집계.

왜: 서울 밖 지역(충북·충남 등)은 서울 상권분석 API가 없다. 하지만 소진공 상가업소 API는
    전국을 월 단위로 제공한다. 이걸로 '어느 시군에 무슨 업종이 몇 개'까지는 서울급으로 만든다.
    (카드매출·객단가·소비는 여전히 공개 없음 — 여기서는 점포·업종만.)

API: https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong
     divId=ctprvnCd, key=<시도코드>  → 그 시도의 상가업소 전량(페이징).
     응답의 signguNm(시군구명)·indsLclsNm(업종 대분류)으로 집계 → 시군 코드 몰라도 됨(견고).

환경변수: DATA_GO_KR_KEY (공공데이터포털 인증키). Encoding/Decoding 키 형태 모두 처리.

출력: frontend/stores_<region>.json
  { region, ctprvnCd, updated, total, by_industry:{업종:수}, gu:{시군:{total, ind:{업종:수}}} }

    python collect_stores_region.py 43 충청북도   # 충북
    python collect_stores_region.py 44 충청남도   # 충남
    python collect_stores_region.py --check
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KEY  = os.environ.get("DATA_GO_KR_KEY", "").strip()
BASE = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong"

# 시도코드 → 출력 파일 슬러그
SLUG = {"11": "seoul", "43": "chungbuk", "44": "chungnam"}

def enc_key(k):
    # 이미 %XX 인코딩돼 있으면 그대로, 아니면 인코딩(공공데이터포털 Encoding/Decoding 키 모두 대응)
    return k if "%" in k else urllib.parse.quote(k, safe="")

def fetch(ctprvn, page, rows=1000):
    qs = urllib.parse.urlencode({
        "serviceKey": "__KEY__", "divId": "ctprvnCd", "key": ctprvn,
        "pageNo": page, "numOfRows": rows, "type": "json",
    })
    url = f"{BASE}?{qs}".replace("__KEY__", enc_key(KEY))
    req = urllib.request.Request(url, headers={"User-Agent": "sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))

def items_of(d):
    # 응답 구조 방어적으로 탐색: body.items.item (list 또는 dict)
    body = (d.get("body") or (d.get("response") or {}).get("body") or {})
    items = (body.get("items") or {})
    it = items.get("item") if isinstance(items, dict) else items
    if it is None: it = []
    if isinstance(it, dict): it = [it]
    total = int(body.get("totalCount") or 0)
    return it, total

def aggregate(all_items):
    by_ind = {}
    gu = {}
    for s in all_items:
        signgu = (s.get("signguNm") or "").strip()
        ind = (s.get("indsLclsNm") or "기타").strip()
        if not signgu:
            continue
        by_ind[ind] = by_ind.get(ind, 0) + 1
        g = gu.setdefault(signgu, {"total": 0, "ind": {}})
        g["total"] += 1
        g["ind"][ind] = g["ind"].get(ind, 0) + 1
    return by_ind, gu

def main():
    if "--check" in sys.argv:
        print("DATA_GO_KR_KEY", "존재" if KEY else "없음")
        return 0 if KEY else 1
    if len(sys.argv) < 3:
        print("사용법: python collect_stores_region.py <시도코드> <지역명>  (예: 43 충청북도)")
        return 2
    ctprvn, region = sys.argv[1], sys.argv[2]
    slug = SLUG.get(ctprvn, ctprvn)
    out_path = os.path.join(ROOT, "frontend", f"stores_{slug}.json")
    if not KEY:
        print("DATA_GO_KR_KEY 없음 — 수집 생략(정직).")
        return 1

    all_items = []
    total = None
    page = 1
    while True:
        for attempt in range(4):
            try:
                d = fetch(ctprvn, page); break
            except Exception as e:
                if attempt == 3:
                    print("요청 실패:", e);
                    if not all_items: return 3
                    d = None; break
                time.sleep(2 * (attempt + 1))
        if d is None:
            break
        it, tc = items_of(d)
        if total is None:
            total = tc
            print(f"{region}({ctprvn}) 총 {total:,}건 · 페이지당 1000")
        all_items.extend(it)
        if not it or len(all_items) >= (total or 0):
            break
        page += 1
        if page % 20 == 0:
            print(f"  {len(all_items):,} / {total:,} 수집")
        time.sleep(0.1)

    if not all_items:
        print("수집 0건 — 키/파라미터 확인 필요"); return 4
    by_ind, gu = aggregate(all_items)
    # 기준시점(period): 소진공 상가업소는 월 단위 최신 스냅샷 → 현재 연·분기로 표기.
    # 모든 지역 레이어를 '같은 연·분기'로 맞추기 위한 기준값. 다른 데이터와 분기가 다르면 검증에서 잡는다.
    now = datetime.datetime.utcnow()
    quarter = f"{now.year}Q{(now.month - 1)//3 + 1}"
    out = {
        "region": region, "ctprvnCd": ctprvn,
        "updated": now.strftime("%Y-%m-%d"),
        "period": quarter,          # 기준 연·분기(레이어 시점 정렬용)
        "source": "소상공인시장진흥공단 상가업소(월 갱신)",
        "total": len(all_items),
        "by_industry": dict(sorted(by_ind.items(), key=lambda x: -x[1])),
        "gu": gu,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {out_path} · 시군 {len(gu)}개 · 업종 {len(by_ind)}종 · 점포 {len(all_items):,}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
