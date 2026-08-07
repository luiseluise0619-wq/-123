#!/usr/bin/env python3
"""
업종별 매출 예측 — 정직한 백테스트(관성을 이길 때만 예측 제공).

입력: frontend/sales_history.json (업종별 분기 매출 시계열)
방법 비교(각 업종, 워크포워드 백테스트):
  - naive     : 다음 분기 = 직전 분기 (관성/persistence)
  - seasonal  : 다음 분기 = 작년 같은 분기
  - trend     : 최근 4분기 선형회귀 외삽
각 방법의 MAPE(평균절대백분율오차)를 홀드아웃으로 계산.
→ 관성(naive)보다 유의미하게 나은 방법이 있을 때만 그 방법으로 다음 분기 예측.
   아니면 beats_naive=false 로 정직하게 "예측 근거 부족" 표기.

출력: frontend/sales_forecast.json
  { updated, quarters, ind:{ 업종:{ next_q, method, forecast, mape, naive_mape, beats_naive } } }
"""
import os, sys, json, datetime
from collect_util import load_json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HISTP = os.path.join(ROOT, "frontend", "sales_history.json")
OUT   = os.path.join(ROOT, "frontend", "sales_forecast.json")

def next_q(q):
    y,qq=int(q[:4]),int(q[4]); qq+=1
    if qq>4: y+=1; qq=1
    return f"{y}{qq}"

def naive(series, i):            # series[:i] 로 series[i] 예측 = 직전값
    return series[i-1] if i>=1 else None
def seasonal(series, i):
    return series[i-4] if i>=4 else None
def trend(series, i):
    if i<4: return None
    xs=list(range(i-4,i)); ys=series[i-4:i]
    n=len(xs); sx=sum(xs); sy=sum(ys); sxx=sum(x*x for x in xs); sxy=sum(x*y for x,y in zip(xs,ys))
    d=n*sxx-sx*sx
    if d==0: return ys[-1]
    b=(n*sxy-sx*sy)/d; a=(sy-b*sx)/n
    return max(0.0, a+b*i)

METHODS={"naive":naive,"seasonal":seasonal,"trend":trend}

def mape(series, fn):
    errs=[]
    for i in range(1,len(series)):
        p=fn(series,i)
        if p is None or series[i]==0: continue
        errs.append(abs(p-series[i])/abs(series[i]))
    return (sum(errs)/len(errs)*100) if errs else None

def main():
    hist=load_json(HISTP)
    if not hist or not hist.get("ind"):
        print("sales_history.json 없음 — 예측 생략(정직).")
        return 0
    quarters=hist["quarters"]
    out={}
    beat=0; total=0
    for nm, qmap in hist["ind"].items():
        series=[qmap.get(q,0) for q in quarters]
        # 앞쪽 결측(0) 제거: 첫 유효값부터
        first=next((k for k,v in enumerate(series) if v>0), None)
        if first is None: continue
        s=series[first:]
        if len(s)<8: continue          # 최소 8분기(2년) 필요
        scores={m:mape(s,fn) for m,fn in METHODS.items()}
        nv=scores.get("naive")
        if nv is None: continue
        total+=1
        # 관성보다 5%p 이상 낮은 오차의 방법만 채택
        cand=[(m,e) for m,e in scores.items() if m!="naive" and e is not None and e < nv-5]
        cand.sort(key=lambda x:x[1])
        if cand:
            method,err=cand[0]; beats=True; beat+=1
        else:
            method,err="naive",nv; beats=False
        fc=METHODS[method](s+[0], len(s))   # 다음 분기 예측
        out[nm]={
            "next_q": next_q(quarters[-1]),
            "method": method, "forecast": round(fc) if fc else None,
            "mape": round(err,1) if err is not None else None,
            "naive_mape": round(nv,1),
            "beats_naive": beats,
        }
    result={"updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
            "quarters":quarters, "n_industries":total, "n_beat_naive":beat,
            "ind":dict(sorted(out.items(), key=lambda x:(not x[1]["beats_naive"], x[1]["mape"] or 999)))}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(result, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print(f"업종 {total}개 중 관성을 이긴 예측: {beat}개")
    print("저장:", OUT)
    if total and beat==0:
        print("→ 정직한 결론: 어떤 업종도 관성을 유의미하게 못 이김. 예측 대신 손익분기 계산 권장.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
