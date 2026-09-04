#!/usr/bin/env python3
"""
지도 번들 재생성 — frontend/data-bundle.js (window.__SANGGWON).

메인 지도(index.html)는 개별 JSON을 fetch 하지 않고 이 '구운 번들'에서 읽는다.
그동안 이 번들을 굽는 스크립트가 저장소에 없어서(문서만 존재), 자동 갱신 워크플로가
JSON 들을 갱신해도 지도는 옛 스냅샷에 고정돼 있었다. 이 스크립트가 그 구멍을 메운다.

번들 구조(docs/BUILD-DEPLOY.md 와 동일):
  window.__SANGGWON = { core, geo, pop, park, stores, sales, repop, work, income, forecast };
  window.__SANGGWON.stores.gu = { 자치구:{ 업종:점포수 } };

원칙:
  - core / geo 는 어떤 JSON 에도 없는 '수동 소스'(폐업통계·부동산원 임대료·소상공인 벤치마크·
    자치구 경계 SVG)라 기존 번들에서 그대로 보존한다.
  - pop/park/stores/sales/repop/work/income/forecast 8개 동적 레이어는 최신 JSON 으로 교체.
  - stores.gu 는 store_gu_ind.json(자치구×업종 점포수)에서 {자치구:{업종:stores}} 로 재구성.
  - JSON 이 없거나 available:false 면 그 레이어만 기존 번들값으로 폴백(지도 회귀 방지). 지어냄 없음.

    python build_bundle.py
출력: frontend/data-bundle.js
"""
import os, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FRONT = os.path.join(ROOT, "frontend")
BUNDLE = os.path.join(FRONT, "data-bundle.js")
PREFIX = "window.__SANGGWON="

# 번들 키 ← 소스 JSON 파일
DYNAMIC = {
    "pop": "livepop_gu.json",
    "park": "parking_gu.json",
    "stores": "stores_by_industry.json",
    "sales": "sales_by_industry.json",
    "repop": "repop.json",
    "work": "workpop.json",
    "income": "income.json",
    "forecast": "sales_forecast.json",
}
ORDER = ["core", "geo", "pop", "park", "stores", "sales", "repop", "work", "income", "forecast"]


def load_json(name):
    p = os.path.join(FRONT, name)
    if not os.path.exists(p):
        return None
    try:
        return json.load(open(p, encoding="utf-8"))
    except (ValueError, OSError) as e:
        print(f"  ! {name} 읽기 실패: {e}")
        return None


def parse_existing_bundle():
    """기존 data-bundle.js → (main dict, stores.gu dict). 없으면 (None, None)."""
    if not os.path.exists(BUNDLE):
        return None, None
    return parse_bundle_text(open(BUNDLE, encoding="utf-8").read())


def parse_bundle_text(raw):
    main, storesgu = None, None
    for stmt in raw.split(";\n"):
        stmt = stmt.strip().rstrip(";").strip()
        if not stmt:
            continue
        if stmt.startswith(PREFIX):
            try:
                main = json.loads(stmt[len(PREFIX):].strip())
            except ValueError as e:
                print(f"  ! 기존 번들 메인 파싱 실패: {e}")
        elif stmt.startswith("window.__SANGGWON.stores.gu="):
            try:
                storesgu = json.loads(stmt.split("=", 1)[1].strip())
            except ValueError as e:
                print(f"  ! 기존 번들 stores.gu 파싱 실패: {e}")
    return main, storesgu


def usable(d):
    """JSON 이 실데이터로 쓸 만한가(available:false 아님)."""
    return isinstance(d, (dict, list)) and not (isinstance(d, dict) and d.get("available") is False)


def build_stores_gu(store_gu_ind):
    """store_gu_ind.json → {자치구:{업종:점포수}} (index.html line ~1463 형태)."""
    out = {}
    for gu, rec in (store_gu_ind.get("gu") or {}).items():
        ind = rec.get("ind") or {}
        out[gu] = {name: (v.get("stores") or 0) for name, v in ind.items()}
    return out


def main():
    old_main, old_storesgu = parse_existing_bundle()
    if not old_main:
        print("기존 번들을 파싱할 수 없어 중단(core/geo 보존 불가). data-bundle.js 확인 필요.")
        return 2

    # core / geo 는 항상 보존(수동 소스, JSON 없음)
    bundle = {"core": old_main.get("core"), "geo": old_main.get("geo")}
    if bundle["core"] is None or bundle["geo"] is None:
        print("기존 번들에 core/geo 가 없음 — 중단(재구성 불가).")
        return 2

    # 동적 레이어: 최신 JSON, 없으면 기존값 폴백
    kept, fresh = [], []
    for key, fname in DYNAMIC.items():
        j = load_json(fname)
        if usable(j):
            bundle[key] = j
            fresh.append(key)
        else:
            bundle[key] = old_main.get(key)
            kept.append(f"{key}({fname})")

    # stores.gu 재구성(store_gu_ind.json), 없으면 기존 패치 보존
    sgi = load_json("store_gu_ind.json")
    if usable(sgi) and sgi.get("gu"):
        stores_gu = build_stores_gu(sgi)
        stores_gu_src = f"store_gu_ind.json ({len(stores_gu)}구, {sgi.get('quarter')})"
    elif old_storesgu:
        stores_gu = old_storesgu
        stores_gu_src = "기존 번들 보존(store_gu_ind 미가용)"
    else:
        stores_gu = {}
        stores_gu_src = "없음"

    # stores 메인에는 gu 를 넣지 않고, 원본과 동일하게 별도 문으로 패치
    if isinstance(bundle.get("stores"), dict):
        bundle["stores"] = {k: v for k, v in bundle["stores"].items() if k != "gu"}

    # 직렬화(원본과 동일한 컴팩트 형식)
    main_obj = {k: bundle[k] for k in ORDER}
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    js = (PREFIX + dump(main_obj) + ";\n"
          + "window.__SANGGWON.stores.gu=" + dump(stores_gu) + ";\n")

    # 검증에 통과한 것만 실제 파일이 된다.
    # 예전에는 먼저 덮어쓰고 나서 검증했다 — 검증이 실패해도 깨진 번들이 이미
    # 디스크에 있고, CI 는 continue-on-error 라 그대로 커밋된다(메인 지도 전체가 깨진다).
    # 임시 파일에 쓰고, 그 내용을 되읽어 검증한 뒤에만 원자적으로 교체한다.
    tmp = BUNDLE + ".tmp"
    open(tmp, "w", encoding="utf-8").write(js)
    chk_main, chk_gu = parse_bundle_text(open(tmp, encoding="utf-8").read())
    ok = bool(chk_main) and set(chk_main.keys()) == set(ORDER) and isinstance(chk_gu, dict)
    if ok:
        os.replace(tmp, BUNDLE)
    else:
        os.remove(tmp)
        print("  ★ 재파싱 검증 실패 — 기존 번들을 그대로 둔다(덮어쓰지 않음).")
    print(f"저장: {BUNDLE}")
    print(f"  최신 교체: {', '.join(fresh) or '없음'}")
    print(f"  기존 보존: {', '.join(kept) or '없음'} + core, geo")
    print(f"  stores.gu: {stores_gu_src}")
    print(f"  재파싱 검증: {'OK' if ok else '실패 ★'}")
    return 0 if ok else 3


if __name__ == "__main__":
    sys.exit(main())
