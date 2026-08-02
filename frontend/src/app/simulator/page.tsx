"use client";

import { useState } from "react";
import { Compass, Sparkles, CheckCircle2, AlertTriangle, ArrowUpRight, Award } from "lucide-react";
import { apiClient } from "@/lib/api";

export default function SimulatorPage() {
  const [industry, setIndustry] = useState("카페/디저트");
  const [budget, setBudget] = useState(100000000);
  const [region, setRegion] = useState("서울");
  const [loading, setLoading] = useState(false);

  const [topDistricts, setTopDistricts] = useState<any[]>([
    {
      rank: 1,
      district_name: "서울시 성동구 성수동2가",
      decision_score: 88.5,
      confidence_score: 91.2,
      expected_revenue_krw: 38500000,
      success_prob_pct: 86.4,
      closure_risk: "LOW",
      opportunity_type: "GREEN",
      opportunity_label: "기회 지역 (수요 성장 대비 공급 부족)",
      reasons: [
        "20~30대 젊은 유동인구 비율 상위 3%",
        "디저트/음료 소비 지출 3년 연속 상승세",
        "지하철 성수역 도보 5분 접근성"
      ],
      risk_factors: [
        "주변 상가 평균 임대료 수준이 비교적 높음",
        "주말 경쟁 업체 방문객 분산 가능성"
      ]
    },
    {
      rank: 2,
      district_name: "서울시 마포구 망원동",
      decision_score: 83.2,
      confidence_score: 89.5,
      expected_revenue_krw: 32000000,
      success_prob_pct: 81.0,
      closure_risk: "LOW",
      opportunity_type: "GREEN",
      opportunity_label: "기회 지역",
      reasons: [
        "망원시장 인근 관광/방문 인구 지속 유입",
        "성수동 대비 상대적으로 안정적인 임대료"
      ],
      risk_factors: ["주차 공간 부족으로 차량 방문객 제한"]
    },
    {
      rank: 3,
      district_name: "서울시 마포구 연남동",
      decision_score: 79.8,
      confidence_score: 88.0,
      expected_revenue_krw: 34000000,
      success_prob_pct: 77.5,
      closure_risk: "MEDIUM",
      opportunity_type: "BLUE",
      opportunity_label: "안정적 성숙 상권",
      reasons: ["경의선 숲길 기반 꾸준한 주말 유동인구"],
      risk_factors: ["동일 업종 카페 밀집도 레드오션 리스크"]
    },
    {
      rank: 4,
      district_name: "서울시 용산구 한남동",
      decision_score: 76.4,
      confidence_score: 87.2,
      expected_revenue_krw: 41000000,
      success_prob_pct: 74.0,
      closure_risk: "MEDIUM",
      opportunity_type: "BLUE",
      opportunity_label: "성숙 상권",
      reasons: ["고객 평균 객단가 매우 높음"],
      risk_factors: ["높은 초기 권리금 및 임대 보증금 부담"]
    },
    {
      rank: 5,
      district_name: "서울시 송파구 송리단길",
      decision_score: 74.1,
      confidence_score: 86.0,
      expected_revenue_krw: 29500000,
      success_prob_pct: 72.8,
      closure_risk: "LOW",
      opportunity_type: "GREEN",
      opportunity_label: "기회 상권",
      reasons: ["석촌호수 유동인구 수혜"],
      risk_factors: ["평일 주간 직장인 수요 상대적 부족"]
    }
  ]);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.post("/simulator/recommend", { industry, budget, region });
      if (res.data.top5_districts) {
        setTopDistricts(res.data.top5_districts);
      }
    } catch (err) {
      console.log("Using Mock top 5");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl">
          <Compass className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">AI Startup Simulator (창업 의사결정 시뮬레이터)</h1>
          <p className="text-xs text-slate-400">
            예산, 업종, 희망지역 조건에 맞춰 성공 확률이 높은 TOP 5 최적 상권을 랭킹 순으로 시뮬레이션합니다.
          </p>
        </div>
      </div>

      {/* Input Conditions Form */}
      <form onSubmit={handleSimulate} className="glass-panel p-6 rounded-2xl border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">창업 업종</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-slate-900 text-white text-xs border border-slate-800 rounded-xl p-2.5 focus:border-cyan-400 focus:outline-none"
          >
            <option value="카페/디저트">카페 / 디저트</option>
            <option value="음식점/식당">음식점 / 식당</option>
            <option value="병의원/클리닉">병의원 / 클리닉</option>
            <option value="미용/뷰티">미용 / 뷰티</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">창업 예산</label>
          <select
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full bg-slate-900 text-white text-xs border border-slate-800 rounded-xl p-2.5 focus:border-cyan-400 focus:outline-none"
          >
            <option value={50000000}>5,000만원</option>
            <option value={100000000}>1억원</option>
            <option value={200000000}>2억원</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">희망 지역</label>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full bg-slate-900 text-white text-xs border border-slate-800 rounded-xl p-2.5 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? "AI 시뮬레이션 중..." : "TOP 5 상권 시뮬레이션"}</span>
          </button>
        </div>
      </form>

      {/* TOP 5 Ranking List Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-200 flex items-center space-x-2">
          <span>AI 추천 상권 TOP 5</span>
          <span className="text-xs font-normal text-cyan-400">Multi-Factor Decision Ranking</span>
        </h2>

        <div className="space-y-4">
          {topDistricts.map((item) => (
            <div
              key={item.rank}
              className={`glass-panel p-6 rounded-2xl border transition-all ${
                item.rank === 1
                  ? "border-cyan-500/50 shadow-xl shadow-cyan-500/10 bg-slate-900/90"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                      item.rank === 1
                        ? "bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    #{item.rank}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center space-x-2">
                      <span>{item.district_name}</span>
                      {item.rank === 1 && (
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <Award className="w-3 h-3" />
                          <span>AI 최우선 추천</span>
                        </span>
                      )}
                    </h3>
                    <span className="text-xs text-slate-400">{item.opportunity_label}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">AI Decision Score</span>
                    <span className="text-2xl font-black text-cyan-400">{item.decision_score}점</span>
                  </div>
                  <div className="text-right border-l border-slate-800 pl-6">
                    <span className="text-[10px] text-slate-400 block">예상 월 매출</span>
                    <span className="text-base font-bold text-emerald-400">
                      ₩{item.expected_revenue_krw.toLocaleString()}원
                    </span>
                  </div>
                  <div className="text-right border-l border-slate-800 pl-6">
                    <span className="text-[10px] text-slate-400 block">성공 확률</span>
                    <span className="text-base font-bold text-slate-200">{item.success_prob_pct}%</span>
                  </div>
                </div>
              </div>

              {/* SHAP Reasons & Risk Factors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-emerald-950/20 border border-emerald-500/20 p-3.5 rounded-xl space-y-1.5">
                  <span className="font-bold text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>선정 이유 (SHAP 긍정 요인)</span>
                  </span>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {item.reasons.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-rose-950/20 border border-rose-500/20 p-3.5 rounded-xl space-y-1.5">
                  <span className="font-bold text-rose-400 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>주의 요소 (감점 사유)</span>
                  </span>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {item.risk_factors.map((rf: string, idx: number) => (
                      <li key={idx}>{rf}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
