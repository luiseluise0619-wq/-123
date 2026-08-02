"use client";

import { Activity, ShieldCheck, Cpu, Database, Server, RefreshCw } from "lucide-react";

export default function AdminMonitoringPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl">
            <Activity className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">MLOps Monitoring Admin Console</h1>
            <p className="text-xs text-slate-400">
              Data Drift, Prediction Drift, Model Metrics 및 Feature Store 상태를 모니터링합니다.
            </p>
          </div>
        </div>

        <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 flex items-center space-x-1.5 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>모델 수동 재학습 트리거</span>
        </button>
      </div>

      {/* Top Status Metric Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Data Drift (PSI Score)</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">0.042</div>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full inline-block">
            STABLE (표류 없음)
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Prediction Drift</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400">0.015</div>
          <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full inline-block">
            NORMAL (정상)
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Success Classifier Accuracy</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">88.5%</div>
          <span className="text-[10px] text-slate-400 block">ROC-AUC = 0.892</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Average Data Quality</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400">0.942</div>
          <span className="text-[10px] text-slate-400 block">Feature Store: 1,500 records</span>
        </div>
      </div>

      {/* Active Model Registry Details */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-indigo-400" />
          <span>Active Production Model Registry (v1.0)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block">LightGBM Revenue Regressor</span>
            <span className="font-bold text-white block">RMSE: ₩2,450,000 | R²: 0.885</span>
            <span className="text-[10px] text-emerald-400">Baseline 대비 +34.2% 개선</span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block">LightGBM Success Classifier</span>
            <span className="font-bold text-white block">Accuracy: 88.5% | ROC-AUC: 0.993</span>
            <span className="text-[10px] text-emerald-400">성공/실패 이분법 정밀 추정</span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block">LightGBM Closure Risk Classifier</span>
            <span className="font-bold text-white block">Accuracy: 88.3% | Multi-class</span>
            <span className="text-[10px] text-cyan-400">LOW / MEDIUM / HIGH 리스크 분류</span>
          </div>
        </div>
      </div>
    </div>
  );
}
