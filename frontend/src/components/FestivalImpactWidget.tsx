"use client";

import { useState } from "react";
import { Calendar, PartyPopper, TrendingUp, Users, Sparkles } from "lucide-react";

export function FestivalImpactWidget() {
  const [eventName, setEventName] = useState("성수 디저트 & 아티스트 팝업 페스티벌");
  const [visitors, setVisitors] = useState<number>(50000);
  const [duration, setDuration] = useState<number>(3);
  const [impactData, setImpactData] = useState<any>({
    foot_traffic_surge_pct: 48.6,
    total_economic_impact_krw: 1890000000, // 18.9억
    industry_revenue_surge: {
      "카페/디저트": 35.2,
      "음식점/식당": 28.4,
      "소매/패션": 18.5
    },
    recommended_event_strategy: "축제 3일간 20대 유동인구 급증에 대비하여 테이크아웃 전용 시그니처 세트를 구성하고 원자재 재고를 30% 증대 확보하세요."
  });

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const surge = +((visitors / 25000) * 18 * 1.35).toFixed(1);
    setImpactData({
      foot_traffic_surge_pct: surge,
      total_economic_impact_krw: Math.round(visitors * 28000 * 1.35),
      industry_revenue_surge: {
        "카페/디저트": +(surge * 0.85).toFixed(1),
        "음식점/식당": +(surge * 0.70).toFixed(1),
        "소매/패션": +(surge * 0.50).toFixed(1)
      },
      recommended_event_strategy: `축제 기간(${duration}일간) 동안 방문객 유입에 대비해 피크타임 테이크아웃 세트 메뉴 구성과 사전 원자재 재고 확보가 필수적입니다.`
    });
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-purple-500/30 bg-gradient-to-b from-slate-900/90 to-purple-950/20 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <PartyPopper className="w-5 h-5 text-purple-400" />
          <h3 className="text-base font-bold text-white">축제/이벤트 상권 경제 효과 분석기</h3>
        </div>
        <span className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
          Event Economic Model
        </span>
      </div>

      <form onSubmit={handleCalculate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
        <div>
          <label className="text-slate-400 block mb-1">축제/행사명</label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="w-full bg-slate-900 text-white rounded p-1.5 border border-slate-800 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-slate-400 block mb-1">예상 방문객 수</label>
          <input
            type="number"
            value={visitors}
            onChange={(e) => setVisitors(Number(e.target.value))}
            className="w-full bg-slate-900 text-white rounded p-1.5 border border-slate-800 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-slate-400 block mb-1">행사 기간(일)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full bg-slate-900 text-white rounded p-1.5 border border-slate-800 focus:outline-none"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold rounded shadow transition-transform active:scale-95"
          >
            경제 효과 계산
          </button>
        </div>
      </form>

      {/* Calculated Results */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-400 block flex items-center space-x-1">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>유동인구 증가율</span>
          </span>
          <span className="text-2xl font-black text-purple-400">+{impactData.foot_traffic_surge_pct}%</span>
          <span className="text-[10px] text-slate-400 block">축제 기간 일평균 유입</span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-400 block flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>상권 총 파급 경제 효과</span>
          </span>
          <span className="text-2xl font-black text-emerald-400">
            ₩{(impactData.total_economic_impact_krw / 100000000).toFixed(1)}억원
          </span>
          <span className="text-[10px] text-slate-400 block">주변 상권 소비 유발액</span>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-400 block font-bold text-cyan-300">최대 수혜 업종 1위</span>
          <div className="flex justify-between items-center text-white font-bold text-sm pt-1">
            <span>카페/디저트</span>
            <span className="text-cyan-400">+{impactData.industry_revenue_surge["카페/디저트"]}% 매출 상승</span>
          </div>
          <span className="text-[10px] text-slate-400 block">음식점: +{impactData.industry_revenue_surge["음식점/식당"]}%</span>
        </div>
      </div>

      <div className="p-3 bg-purple-950/40 rounded-xl text-xs text-purple-200 border border-purple-500/20 flex items-start space-x-2">
        <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
        <p>{impactData.recommended_event_strategy}</p>
      </div>
    </div>
  );
}
