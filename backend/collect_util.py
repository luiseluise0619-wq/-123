#!/usr/bin/env python3
"""
수집기 공용 유틸 — '값을 통째로 덮지 않고 무엇이 바뀌었는지' 기록.

apply_quarter_diff:
  - 새 분기 데이터가 오면 이전 분기 값을 각 항목의 'prev'로 보존
  - 같은 분기면(주간 재실행 등 실데이터 불변) 기존 prev를 그대로 유지
  - 분기가 바뀐 경우 변화량이 큰 항목(movers) 목록 반환
push_update:
  - frontend/updates.json 에 '무엇이 언제 바뀌었는지' 피드로 누적(최근 30건)
"""
import os, json, datetime

def load_json(p):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return None

def apply_quarter_diff(old, new, metrics):
    """new['ind'][name] 에 prev(이전 분기 값) 부착. movers=[(name,delta,old,new)] 반환."""
    changes = []
    if not old or not old.get("ind"):
        new["prev_quarter"] = None
        return changes
    same = old.get("quarter") == new.get("quarter")
    for nm, v in new["ind"].items():
        ov = old["ind"].get(nm)
        if same:
            if ov and ov.get("prev"):
                v["prev"] = ov["prev"]            # 같은 분기: 이전 prev 유지
        elif ov:
            v["prev"] = {m: ov.get(m) for m in metrics if m in ov}
    if same:
        new["prev_quarter"] = old.get("prev_quarter")
        return changes
    # 분기 변경 → movers 계산(첫 지표 기준)
    new["prev_quarter"] = old.get("quarter")
    m0 = metrics[0]
    for nm, v in new["ind"].items():
        ov = old["ind"].get(nm)
        if ov and ov.get(m0) is not None and v.get(m0) is not None:
            changes.append((nm, v[m0] - ov[m0], ov[m0], v[m0]))
    changes.sort(key=lambda x: -abs(x[1]))
    return changes

def mark_unavailable(path, reason):
    """수집 실패를 기록하되, **이미 있는 실데이터는 절대 덮어쓰지 않는다.**

    왜 이게 필요한가
      수집기들이 실패할 때 `{available:false}` 한 줄로 출력 파일을 덮어썼다.
      그런데 실패 원인의 대부분은 '데이터가 없어진 것'이 아니라
      **키 만료 · 활용기간 종료 · API 일시 장애 · 한도 초과** 같은 일시적인 것이다.
      일시적 실패로 멀쩡한 파일을 지우면:
        · 상권 1,650곳 생존지표, 1,493곳 배후 아파트 같은 자료가 통째로 사라지고
        · CI 는 continue-on-error 라 초록불로 끝나며
        · 커밋 목록에 그 파일이 있으므로 **빈 파일이 그대로 배포된다.**
      게다가 기회 점수는 zone_apt(수요의 45%)·zone_facility(20%)를 쓰므로
      점수 자체가 조용히 달라진다.

    그래서 규칙은 하나다 — **어제 되던 데이터가 오늘 실패했다면 어제 것을 지킨다.**
    (collect_livepop.py 가 이미 같은 판단을 하고 있다: "빈 값으로 덮으면 화면이
     '유동인구 0'을 진짜 값처럼 보여준다".)

    돌려주는 값: True = 실제로 표시를 썼음 / False = 기존 데이터를 지키느라 안 썼음
    """
    old = load_json(path)
    has_real = isinstance(old, dict) and old.get("available") is not False and \
        any(isinstance(v, (dict, list)) and len(v) > 0 for v in old.values())
    if has_real:
        print(f"수집 실패({reason}) — 기존 데이터를 유지합니다(덮어쓰지 않음).")
        return False
    json.dump({"available": False, "reason": reason,
               "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d")},
              open(path, "w", encoding="utf-8"), ensure_ascii=False)
    print("available=false:", reason)
    return True


def push_update(root, dataset, quarter, note):
    p = os.path.join(root, "frontend", "updates.json")
    feed = load_json(p) or {"items": []}
    feed["items"].insert(0, {
        "date": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "dataset": dataset, "quarter": quarter, "note": note,
    })
    feed["items"] = feed["items"][:30]
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(feed, open(p, "w", encoding="utf-8"), ensure_ascii=False)
