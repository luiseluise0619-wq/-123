"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScoreCard } from "@/components/ScoreCard";
import { PersonaSwitcher } from "@/components/PersonaSwitcher";
import { ShapVisualization } from "@/components/ShapVisualization";
import { CounterfactualWidget } from "@/components/CounterfactualWidget";
import { FestivalImpactWidget } from "@/components/FestivalImpactWidget";
import { apiClient, MOCK_ANALYSIS_RESULT } from "@/lib/api";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Search, MapPin, Building, Sparkles } from "lucide-react";

function DashboardContent() {
  const searchParams = useSearchParams();
  const [address, setAddress] = useState(searchParams.get("address") || "서울시 성동구 성수동2가");
  const [industry, setIndustry] = useState(searchParams.get("industry") || "카페/디저트");
  const [persona, setPersona] = useState("founder");
  const [data, setData] = useState<any>(MOCK_ANALYSIS_RESULT);
  const [loading, setLoading] = useState(false);

  // Time Series Mock Data for Recharts
  const timeSeriesData = [
    { period: "2024.Q1", revenue: 2900, footTraffic: 28000, competitors: 10 },
    { period: "2024.Q3", revenue: 3100, footTraffic: 30000, competitors: 11 },
    { period: "2025.Q1", revenue: 3400, footTraffic: 32000, competitors: 12 },
    { period: "2025.Q3", revenue: 3650, footTraffic: 33500, competitors: 13 },
    { period: "2026.Q1 (현재)", revenue: 3850, footTraffic: 34500, competitors: 14 },
  ];

  const fetchAnalysis = async (targetAddress: string, targetIndustry: string) => {
    setLoading(true);
    try {
      const res = await apiClient.post("/analysis/analyze", {
        address: targetAddress,
        industry: targetIndustry,
        user_persona: persona
      });
      setData(res.data);
    } catch (e) {
      console.log("Using Mock Data fallback");
      setData(MOCK_ANALYSIS_RESULT);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis(address, industry);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalysis(address, industry);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header Controls Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex flex-1 items-center space-x-3 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="bg-transparent text-xs text-white w-full focus:outline-none"
            placeholder="분석할 상권 주소"
          />
          <Building className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="bg-transparent text-xs text-cyan-300 w-32 focus:outline-none"
            placeholder="업종"
          />
          <button type="submit" className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold hover:bg-cyan-500/30">
            재분석
          </button>
        </form>

        {/* Persona Selector */}
        <PersonaSwitcher currentPersona={persona} onSelectPersona={setPersona} />
      </div>

      {/* Hero Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-xs text-cyan-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 상권 분석 인텔리전스</span>
          </div>
          <h1 className="text-2xl font-black text-white">
            {data.district_name || "성수동2가"} 상권 분석 결과
          </h1>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block">적용된 기회 지도 레이어</span>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full inline-block mt-1">
            {data.opportunity?.zone_label || "기회 지역 (수요 성장 대비 공급 부족)"}
          </span>
        </div>
      </div>

      {/* 1. Score Cards Grid */}
      <ScoreCard
        score={data.decision_score}
        confidence={data.confidence_score}
        expectedRevenue={data.expected_monthly_revenue}
        successProb={data.success_probability_pct}
        closureRisk={data.closure_risk}
        opportunityType={data.opportunity?.zone_type}
        confidenceBreakdown={data.confidence_breakdown}
      />

      {/* 2. Counterfactual Simulator Widget */}
      <CounterfactualWidget
        originalScore={data.decision_score}
        originalRevenue={data.expected_monthly_revenue}
      />

      {/* 3. Festival Economic Impact Widget */}
      <FestivalImpactWidget />

      {/* 4. SHAP Feature Importance Section */}
      <ShapVisualization
        positiveDrivers={data.shap_explanation?.positive_drivers || []}
        riskFactors={data.shap_explanation?.risk_factors || []}
        featureImportance={data.shap_explanation?.top_feature_importance || []}
      />

      {/* 5. 3-Year Time-Series Commercial Trajectory Chart */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">최근 3년 상권 매출 & 유동인구 성장 궤적</h3>
            <p className="text-xs text-slate-400">단순 현재 분석을 넘어 상권이 상승세인지 추적하는 시계열 데이터</p>
          </div>
          <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">성장률 +14.2% ↑</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#00f2fe" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} unit="만원" />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#fff" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#00f2fe" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 text-xs">상권 데이터 분석 로딩 중...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
