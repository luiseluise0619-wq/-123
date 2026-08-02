"use client";

import { useState } from "react";
import { FileText, Printer, Download, Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";
import { MOCK_ANALYSIS_RESULT } from "@/lib/api";

export default function ReportPage() {
  const [data, setData] = useState<any>(MOCK_ANALYSIS_RESULT);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl">
            <FileText className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">AI 상권 분석 & 투자 보고서</h1>
            <p className="text-xs text-slate-400">REP-20260731-885 | 발급일: 2026년 07월 31일</p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 flex items-center space-x-2 transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span>PDF / 인쇄 출력</span>
        </button>
      </div>

      {/* Printable Report Paper */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-8 bg-slate-900/90 shadow-2xl">
        {/* Title Badge */}
        <div className="border-b border-slate-800 pb-6 flex justify-between items-start">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full">
              AI Decision Intelligence Report
            </span>
            <h2 className="text-2xl font-black text-white mt-2">
              {data.address} 상권 분석 보고서
            </h2>
            <p className="text-xs text-slate-400 mt-1">업종: {data.industry} | 창업 예산: ₩100,000,000원</p>
          </div>

          <div className="text-right">
            <div className="text-3xl font-black text-cyan-400">{data.decision_score}점</div>
            <div className="text-[10px] text-slate-400">종합 Decision Score (신뢰도 {data.confidence_score}%)</div>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 block">예상 월 매출액</span>
            <span className="text-xl font-bold text-emerald-400 mt-1 block">
              ₩{data.expected_monthly_revenue.toLocaleString()}원
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 block">창업 성공 확률</span>
            <span className="text-xl font-bold text-cyan-400 mt-1 block">
              {data.success_probability_pct}%
            </span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 block">폐업 리스크</span>
            <span className="text-xl font-bold text-slate-200 mt-1 block">
              {data.closure_risk} (낮음)
            </span>
          </div>
        </div>

        {/* SHAP Data Evidence Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>AI 핵심 근거 (SHAP Feature Importance)</span>
          </h3>

          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
            {data.shap_explanation.positive_drivers.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-slate-300">
                <span>• {item.feature_kr}</span>
                <span className="text-emerald-400 font-semibold">+{item.shap_value} (긍정)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Budget Allocation */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>추천 예산 배분 및 실행 전략</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">인테리어/동선</span>
              <span className="font-bold text-white">4,500만원</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">보증금/임대료</span>
              <span className="font-bold text-white">3,000만원</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">장비/기계류</span>
              <span className="font-bold text-white">2,000만원</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">예비 유동자금</span>
              <span className="font-bold text-white">500만원</span>
            </div>
          </div>
        </div>

        {/* Strategic Guidance Box */}
        <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-slate-300 leading-relaxed">
          <span className="font-bold text-cyan-300 block mb-1">💡 AI 컨설턴트 총평:</span>
          본 성수동 상권은 20~30대 젊은 층 및 직장인 유동량이 풍부하여 초기 디저트 및 테이크아웃 수요 흡수가 매우 유리합니다. 
          초기 매장 구성 시 회전율 중심의 바(Bar) 구조와 주말 특화 라이브 디스플레이 프로모션을 추천합니다.
        </div>
      </div>
    </div>
  );
}
