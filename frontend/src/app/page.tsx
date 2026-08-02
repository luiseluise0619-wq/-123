"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, MapPin, ArrowRight, ShieldCheck, Cpu, Compass, Activity, Coffee, Utensils, Stethoscope, Scissors } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [address, setAddress] = useState("서울시 성동구 성수동2가");
  const [industry, setIndustry] = useState("카페/디저트");
  const [budget, setBudget] = useState(100000000);

  const quickPresets = [
    { label: "성수동 카페 1억원", address: "서울시 성동구 성수동2가", industry: "카페/디저트", budget: 100000000, icon: Coffee },
    { label: "망원동 맛집 8,000만원", address: "서울시 마포구 망원동", industry: "음식점/식당", budget: 80000000, icon: Utensils },
    { label: "강남역 피부과 3억원", address: "서울시 강남구 역삼동", industry: "병의원/클리닉", budget: 300000000, icon: Stethoscope },
    { label: "홍대 뷰티샵 6,000만원", address: "서울시 마포구 서교동", industry: "미용/뷰티", budget: 60000000, icon: Scissors },
  ];

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    router.push(`/dashboard?address=${encodeURIComponent(address)}&industry=${encodeURIComponent(industry)}&budget=${budget}`);
  };

  const applyPreset = (preset: typeof quickPresets[0]) => {
    setAddress(preset.address);
    setIndustry(preset.industry);
    setBudget(preset.budget);
    router.push(`/dashboard?address=${encodeURIComponent(preset.address)}&industry=${encodeURIComponent(preset.industry)}&budget=${preset.budget}`);
  };

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Glowing Particle Backdrop */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-500/20 via-indigo-500/10 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center space-y-8 z-10 py-12">
        {/* Top Tagline */}
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/30 text-cyan-400 text-xs font-semibold shadow-lg shadow-cyan-500/10">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>AI가 분석하는 우리 동네 상권의 미래</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
          어디에 창업할지 <br />
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            AI에게 물어보세요
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          수십 가지 상권 인구, 유동량, 임대료 데이터를 바탕으로 창업 성공 가능성과 예상 월 매출을 데이터 근거와 함께 정밀 예측합니다.
        </p>

        {/* Quick One-Click Demo Presets */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
          <span className="text-xs text-slate-500 mr-1">🔥 원클릭 시연:</span>
          {quickPresets.map((p, idx) => {
            const Icon = p.icon;
            return (
              <button
                key={idx}
                onClick={() => applyPreset(p)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/90 hover:bg-cyan-950/40 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 rounded-xl text-xs font-medium transition-all shadow-sm"
              >
                <Icon className="w-3.5 h-3.5 text-cyan-400" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Gemini Style Futuristic Search Box */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="glass-panel p-3 rounded-2xl border border-cyan-500/40 shadow-2xl glass-glow space-y-3">
            {/* Input Row */}
            <div className="flex items-center space-x-3 px-3 py-2 bg-slate-900/80 rounded-xl border border-slate-800 focus-within:border-cyan-400 transition-colors">
              <MapPin className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="희망 창업 지역 또는 주소를 입력하세요 (예: 서울시 성동구 성수동2가)"
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-lg flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 active:scale-95 transition-transform"
              >
                <span>AI 분석</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Industry Select Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
              <div className="flex items-center space-x-2 text-slate-400">
                <span className="text-[11px]">업종 선택:</span>
                {["카페/디저트", "음식점/식당", "병의원/클리닉", "미용/뷰티"].map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setIndustry(ind)}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      industry === ind
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>

              {/* Budget Select */}
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                <span>예산:</span>
                <select
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="bg-slate-900 text-cyan-300 border border-slate-800 rounded px-2 py-0.5 focus:outline-none"
                >
                  <option value={50000000}>5,000만원</option>
                  <option value={80000000}>8,000만원</option>
                  <option value={100000000}>1억원</option>
                  <option value={300000000}>3억원</option>
                </select>
              </div>
            </div>
          </div>
        </form>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12 text-left max-w-3xl mx-auto">
          <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-cyan-500/40 transition-colors">
            <Cpu className="w-5 h-5 text-cyan-400 mb-2" />
            <h3 className="text-xs font-bold text-white">Multi-ML 예측 엔진</h3>
            <p className="text-[11px] text-slate-400 mt-1">LightGBM & XGBoost 모델로 예상 매출과 성공 확률을 독립 추정합니다.</p>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-cyan-500/40 transition-colors">
            <Compass className="w-5 h-5 text-emerald-400 mb-2" />
            <h3 className="text-xs font-bold text-white">AI Opportunity Map</h3>
            <p className="text-[11px] text-slate-400 mt-1">경쟁 과열지역을 피하고 수요 대비 공급 부족 블루오션 기회를 찾습니다.</p>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-cyan-500/40 transition-colors">
            <ShieldCheck className="w-5 h-5 text-indigo-400 mb-2" />
            <h3 className="text-xs font-bold text-white">SHAP Explainable AI</h3>
            <p className="text-[11px] text-slate-400 mt-1">모든 분석 결과의 근거 요인을 데이터 수치 기반으로 시각화합니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
