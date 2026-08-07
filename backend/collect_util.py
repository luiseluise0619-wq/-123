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
