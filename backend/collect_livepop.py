#!/usr/bin/env python3
"""
서울 생활인구(유동인구) 수집기 → 자치구별 집계.

데이터: 서울 열린데이터광장 '집계구 단위 서울 생활인구(내국인)' ppsLocalResd
  - 집계구별·시간대별 총생활인구 + 연령/성별 세분
  - 행정동코드(ADSTRD_CODE_SE) 앞 5자리 = 자치구 코드 → 자치구로 집계

왜 여러 시각을 받나
-------------------
예전에는 오후 2시 하나만 받았다. 그런데 이 값은 기회점수의 수요(45%) 안에서
다시 35%를 차지한다 — 즉 **기회점수의 약 16%가 '어느 날 오후 2시' 한 장면**으로
정해지고 있었다. 점심 장사와 저녁 장사, 낮 상권과 밤 상권이 완전히 다른데
한 시각으로 전부 줄 세운 셈이다.

이제 하루 여러 시각을 받아 **평균과 피크를 함께** 저장한다.
  tot        = 받은 시각들의 평균 (기존 키. 소비하는 쪽은 그대로 두면 값만 좋아진다)
  by_hour    = 시각별 원값 (어느 시간대 상권인지 판단용)
  peak_hour  = 가장 붐비는 시각, peak_tot = 그때 인원

한계 — 요일은 아직 못 고른다
----------------------------
이 엔드포인트는 시간대(TMZON_PD_SE)만 고를 수 있고 날짜는 서비스가 주는 대로 받는다.
그래서 '평일/주말 구분'은 한 번의 실행으로 안 된다. 대신 실행할 때마다 그날의
기준일과 요일을 함께 적어 두었다(stdr_date · weekday). 자동 수집이 쌓이면
요일이 다른 스냅샷이 모이고, 그때 평일/주말을 나눌 수 있다.
지금 화면에 '평일 평균'이라고 쓰면 거짓말이 된다 — 기준일과 요일을 그대로 표기한다.

지어냄 없음: SEOUL_API_KEY 없으면 아무것도 쓰지 않고 종료(정직).
샌드박스에선 외부망이 막혀 실행 불가 — GitHub Action(러너)에서 실행됨.

출력: frontend/livepop_gu.json · frontend/livepop_dong.json
  { hours, basis, stdr_date, weekday, updated,
    gu:{ 강남구:{tot, m, f, a10..a60, cells, by_hour, peak_hour, peak_tot}, ... } }

    python collect_livepop.py            # 수집·집계·저장
    python collect_livepop.py --check    # 키 존재만 확인
    LIVEPOP_HOURS=14 python collect_livepop.py   # 시각을 줄여 빠르게(옛 동작)
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "livepop_gu.json")

KEY = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "ppsLocalResd"
BASE = "http://openapi.seoul.go.kr:8088"

# 받을 시각들. 상권이 갈리는 지점을 고른 것이고, 근거는 '장사 시간'이다.
#   8  출근·아침       12 점심            15 오후(예전 기준값 14시에 가장 가까움)
#   19 저녁            22 심야
# 호출량은 시각 수에 정비례한다(집계구 약 19,000행 ÷ 1,000 ≒ 19회 × 시각 수).
# 한도에 걸리면 LIVEPOP_HOURS 로 줄인다. 한 개만 넣으면 예전과 같은 동작이 된다.
HOURS = [h.strip() for h in os.environ.get("LIVEPOP_HOURS", "8,12,15,19,22").split(",") if h.strip()]
# 옛 이름도 계속 받는다 — 이걸 쓰던 워크플로·문서가 조용히 깨지지 않게.
if os.environ.get("LIVEPOP_HOUR"):
    HOURS = [os.environ["LIVEPOP_HOUR"].strip()]

WD_KO = ["월", "화", "수", "목", "금", "토", "일"]

def weekday_of(stdr):
    """'20260731' → '금'. 형식이 다르면 None(지어내지 않는다)."""
    try:
        return WD_KO[datetime.date(int(stdr[:4]), int(stdr[4:6]), int(stdr[6:8])).weekday()]
    except Exception:
        return None

# 자치구 코드(행정동코드 앞 5자리) → 자치구명. 지리 상수.
GU = {
 "11110":"종로구","11140":"중구","11170":"용산구","11200":"성동구","11215":"광진구",
 "11230":"동대문구","11260":"중랑구","11290":"성북구","11305":"강북구","11320":"도봉구",
 "11350":"노원구","11380":"은평구","11410":"서대문구","11440":"마포구","11470":"양천구",
 "11500":"강서구","11530":"구로구","11545":"금천구","11560":"영등포구","11590":"동작구",
 "11620":"관악구","11650":"서초구","11680":"강남구","11710":"송파구","11740":"강동구",
}
# 연령 버킷 합산용 접미(남/여 공통). 10대=0~19, 20대=20~24+25~29 ...
AGE = {
 "a10":["F0T9","F10T14","F15T19"], "a20":["F20T24","F25T29"],
 "a30":["F30T34","F35T39"], "a40":["F40T44","F45T49"],
 "a50":["F50T54","F55T59"], "a60":["F60T64","F65T69","F70T74"],
}

def fnum(x):
    try: return float(x)
    except: return 0.0   # '*'(비식별) 은 0 처리

def fetch(start, end, hour):
    # 경로형 옵션: /KEY/xml/SERVICE/START/END/TMZON_PD_SE
    url = f"{BASE}/{urllib.parse.quote(KEY)}/xml/{SERVICE}/{start}/{end}/{hour}/"
    req = urllib.request.Request(url, headers={"User-Agent":"sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8")

def main():
    if not KEY:
        print("SEOUL_API_KEY 없음 — 수집 생략(정직). Action Secrets 에 등록 필요.")
        return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("SEOUL_API_KEY 존재 — 수집 가능"); return 0

    # 행정동(동네) 단위 집계 — 지점이 속한 동네 생활인구용. seoul_dong.geojson 으로 코드→(구,동) 매핑.
    adm_info = {}; code8_to_adm = {}
    try:
        geo = json.load(open(os.path.join(ROOT, "frontend", "seoul_dong.geojson"), encoding="utf-8"))
        for ft in geo.get("features", []):
            p = ft.get("properties", {}); adm = str(p.get("adm") or "")
            if adm:
                adm_info[adm] = (p.get("gu"), p.get("dong")); code8_to_adm[adm[:8]] = adm
    except Exception as ex:
        print("dong geojson 로드 실패 — 행정동 집계 생략:", ex)

    FIELDS = ("tot","m","f","a10","a20","a30","a40","a50","a60")
    def blank():
        d = {k: 0.0 for k in FIELDS}; d["cells"] = 0; return d

    # 시각별로 따로 담는다. 마지막에 평균과 피크를 낸다.
    per_hour_gu, per_hour_dong = {}, {}
    stdr = None
    ok_hours, failed = [], []

    for hour in HOURS:
        try:
            first = fetch(1, 1, hour)
            root = ET.fromstring(first)
            code = root.findtext(".//RESULT/CODE") or "?"
            if code not in ("INFO-000",):
                msg = root.findtext(".//RESULT/MESSAGE")
                print(f"  {hour}시 API 오류: {code} {msg} — 이 시각은 건너뜀")
                failed.append(hour); continue
            total = int(root.findtext(".//list_total_count") or "0")
        except Exception as ex:
            print(f"  {hour}시 첫 호출 실패 — 건너뜀: {ex}")
            failed.append(hour); continue

        print(f"[{hour}시] 총 {total:,}행")
        acc = {g: blank() for g in GU.values()}
        dong_acc = {adm: blank() for adm in adm_info}
        step = 1000
        for s in range(1, total+1, step):
            e = min(s+step-1, total)
            for attempt in range(4):
                try:
                    xml = fetch(s, e, hour); break
                except Exception:
                    if attempt==3: raise
                    time.sleep(2*(attempt+1))
            rt = ET.fromstring(xml)
            for row in rt.findall(".//row"):
                raw = (row.findtext("ADSTRD_CODE_SE") or "")
                g = GU.get(raw[:5])
                if not g: continue
                if stdr is None: stdr = row.findtext("STDR_DE_ID")
                tot = fnum(row.findtext("TOT_LVPOP_CO"))
                # 성별·연령 버킷을 한 번만 계산 → 자치구·행정동 양쪽에 더함
                buck = {"m":0.0,"f":0.0,"a10":0.0,"a20":0.0,"a30":0.0,"a40":0.0,"a50":0.0,"a60":0.0}
                for pref in ("MALE","FEMALE"):
                    for key,sufs in AGE.items():
                        for suf in sufs:
                            v = fnum(row.findtext(f"{pref}_{suf}_LVPOP_CO"))
                            buck[key]+=v; buck["m" if pref=="MALE" else "f"]+=v
                a = acc[g]; a["tot"]+=tot; a["cells"]+=1
                for k,v in buck.items(): a[k]+=v
                # 행정동 단위(코드 전체 또는 앞 8자리로 매칭)
                adm = raw if raw in dong_acc else code8_to_adm.get(raw[:8])
                if adm and adm in dong_acc:
                    da = dong_acc[adm]; da["tot"]+=tot; da["cells"]+=1
                    for k,v in buck.items(): da[k]+=v
            time.sleep(0.2)
        per_hour_gu[hour] = acc
        per_hour_dong[hour] = dong_acc
        ok_hours.append(hour)
        print(f"  [{hour}시] 완료 · 서울 합계 {int(sum(a['tot'] for a in acc.values())):,}명")

    if not ok_hours:
        # 한 시각도 못 받았다면 옛 파일을 덮어쓰지 않는다.
        # 빈 값으로 덮으면 화면이 '유동인구 0'을 진짜 값처럼 보여준다.
        print("받은 시각이 하나도 없음 — 기존 파일을 유지하고 종료(정직).")
        return 2
    if failed:
        print("건너뛴 시각:", ", ".join(failed))

    wd = weekday_of(stdr or "")
    # 화면 캡션에 그대로 들어가는 문자열이라 짧게. 무엇을 평균했는지는 남긴다.
    basis = (f"{len(ok_hours)}개 시각 평균({'·'.join(ok_hours)}시)"
             if len(ok_hours) > 1 else f"{ok_hours[0]}시")

    def merge(per_hour, keys, extra):
        """시각별 누적 → 평균 + 시각별 원값 + 피크. 받은 시각만으로 나눈다."""
        out = {}
        n = len(ok_hours)
        for k in keys:
            base = dict(extra(k))
            by_hour, peak_h, peak_v = {}, None, -1.0
            for h in ok_hours:
                v = per_hour[h][k]
                by_hour[h] = round(v["tot"], 1)
                if v["tot"] > peak_v: peak_v, peak_h = v["tot"], h
            for f in FIELDS:
                base[f] = round(sum(per_hour[h][k][f] for h in ok_hours) / n, 1)
            base["cells"] = per_hour[ok_hours[0]][k]["cells"]
            if n > 1:
                base["by_hour"] = by_hour
                base["peak_hour"] = peak_h
                base["peak_tot"] = round(peak_v, 1)
            out[k] = base
        return out

    meta = {
        "service": SERVICE,
        "hours": ok_hours,
        # 한 시각만 받았을 때는 옛 키(hour)를 그대로 채운다 — 옛 화면이 그대로 동작한다.
        **({"hour": ok_hours[0]} if len(ok_hours) == 1 else {}),
        "basis": basis,
        "stdr_date": stdr, "weekday": wd,
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
    }

    gu_out = merge(per_hour_gu, list(GU.values()), lambda k: {})
    out = dict(meta, gu=gu_out)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    top = sorted(gu_out.items(), key=lambda x:-x[1]["tot"])[:3]
    print("저장:", OUT, "·", basis, "· 기준", stdr, wd or "")
    print("유동인구(평균) 상위:", [(g, int(d["tot"])) for g,d in top])

    # 행정동 단위 산출물(지점 반경 생활인구용)
    live_adm = [a for a in adm_info if per_hour_dong[ok_hours[0]][a]["cells"] > 0]
    dong_out = merge(per_hour_dong, live_adm,
                     lambda a: {"gu": adm_info[a][0], "dong": adm_info[a][1]})
    DONG_OUT = os.path.join(ROOT, "frontend", "livepop_dong.json")
    json.dump(dict(meta,
                   note="행정동 단위 생활인구(내국인) · 지점이 속한 동네 기준. "
                        "tot 은 받은 시각들의 평균, by_hour 는 시각별 원값.",
                   dong=dong_out),
              open(DONG_OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("저장:", DONG_OUT, "· 행정동", len(dong_out))
    return 0

if __name__ == "__main__":
    sys.exit(main())
