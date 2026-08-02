"use client";

import { CheckCircle2, AlertOctagon, HelpCircle } from "lucide-react";

interface ShapFactor {
  feature_kr: string;
  shap_value: number;
  impact: string;
}

interface FeatureImportance {
  feature_kr: string;
  importance_percent: number;
}

interface ShapProps {
  positiveDrivers: ShapFactor[];
  riskFactors: ShapFactor[];
  featureImportance: FeatureImportance[];
}

export function ShapVisualization({ positiveDrivers, riskFactors, featureImportance }: ShapProps) {
  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <span>AI 판단 근거 & Feature Importance</span>
            <span className="text-xs font-normal text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full">
              SHAP Explainable AI
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            머신러닝 예측 결과에 직접적인 영향을 준 상권 변수 기여도 분석
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Positive Drivers (+) */}
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs mb-3">
            <CheckCircle2 className="w-4 h-4" />
            <span>매출 & 성공 기여 긍정 요인 (+ SHAP)</span>
          </div>
          <div className="space-y-2.5">
            {positiveDrivers.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/60 p-2.5 rounded-lg border border-emerald-500/10">
                <span className="text-slate-200 font-medium">{item.feature_kr}</span>
                <span className="text-emerald-400 font-bold">+{item.shap_value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Risk Factors (-) */}
        <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs mb-3">
            <AlertOctagon className="w-4 h-4" />
            <span>주의 및 리스크 감점 요인 (- SHAP)</span>
          </div>
          <div className="space-y-2.5">
            {riskFactors.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/60 p-2.5 rounded-lg border border-rose-500/10">
                <span className="text-slate-200 font-medium">{item.feature_kr}</span>
                <span className="text-rose-400 font-bold">{item.shap_value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Top Feature Importance Progress Bar Chart */}
      <div className="mt-6 pt-5 border-t border-slate-800">
        <h4 className="text-xs font-bold text-slate-300 mb-3">매출 영향 변수 중요도 Top 5</h4>
        <div className="space-y-3">
          {featureImportance.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>{item.feature_kr}</span>
                <span className="font-semibold text-cyan-400">{item.importance_percent}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${item.importance_percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
