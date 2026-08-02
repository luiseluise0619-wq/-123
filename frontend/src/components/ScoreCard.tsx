"use client";

import { ShieldCheck, TrendingUp, AlertTriangle, Sparkles, CheckCircle2, HelpCircle } from "lucide-react";

interface ScoreCardProps {
  score?: number;
  confidence?: number;
  expectedRevenue?: number;
  successProb?: number;
  closureRisk?: string;
  opportunityType?: string;
  confidenceBreakdown?: any;
}

export function ScoreCard({
  score = 87.5,
  confidence = 95.8,
  expectedRevenue = 38500000,
  successProb = 86.4,
  closureRisk = "LOW",
  opportunityType = "GREEN"
}: ScoreCardProps) {
  return (
    <div className="space-y-6">
      {/* 1. Data Trust & Confidence Badge Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-cyan-500/30 p-3.5 rounded-2xl text-xs">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span className="text-white font-bold">분석 데이터: 서울시 상권 빅데이터 (2026.Q1 최신 반영)</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-slate-400">AI 분석 신뢰도:</span>
          <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>높음 ({confidence}%)</span>
          </span>
        </div>
      </div>

      {/* 2. Main Store Diagnosis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Store Health Score */}
        <div className="glass-panel p-5 rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/90 to-cyan-950/20 space-y-2">
          <span className="text-slate-400 text-xs font-semibold block">우리 가게 종합 진단 점수</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-black text-cyan-400">{score}</span>
            <span className="text-xs text-slate-400">/ 100점</span>
          </div>
          <div className="text-[11px] text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded inline-block">
            A등급 (상권 상위 12% 이내)
          </div>
        </div>

        {/* Card 2: Expected Monthly Revenue */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-slate-400 text-xs font-semibold block">예상 월 매출액</span>
          <div className="text-2xl font-black text-emerald-400">
            ₩{expectedRevenue.toLocaleString()}원
          </div>
          <span className="text-[11px] text-slate-400 block">
            창업 성공 가능성 <strong className="text-emerald-400">{successProb}%</strong>
          </span>
        </div>

        {/* Card 3: Closure Risk Diagnosis */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-slate-400 text-xs font-semibold block">손실 및 폐업 리스크</span>
          <div className="text-2xl font-black text-white flex items-center space-x-2">
            <span className="text-emerald-400">안정적 (LOW)</span>
          </div>
          <span className="text-[11px] text-slate-400 block">인근 1년 폐업률 2.1% 수준</span>
        </div>

        {/* Card 4: Action Recommendation */}
        <div className="glass-panel p-5 rounded-2xl border border-purple-500/30 bg-purple-950/10 space-y-2">
          <span className="text-purple-300 text-xs font-semibold block">AI 추천 핵심 개선 과제</span>
          <div className="text-xs font-bold text-white leading-tight">
            점심 피크타임 테이크아웃 회전율 단축
          </div>
          <span className="text-[11px] text-purple-300 block">월 매출 +₩3,500,000원 개선 예상</span>
        </div>
      </div>

      {/* 3. Plain Business Reasons (Replacing technical SHAP) */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>매출 진단 결과: 5가지 핵심 원인 분석</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-emerald-500/20 space-y-1">
            <span className="text-emerald-400 font-bold block">1. 2030 젊은 유동인구 비중 우수 (+28% 매출 견인)</span>
            <p className="text-slate-400 text-[11px]">20~30대 고객 비중이 높아 시그니처 디저트 메뉴 반응도가 우수합니다.</p>
          </div>
          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-emerald-500/20 space-y-1">
            <span className="text-emerald-400 font-bold block">2. 점심 오피스 직장인 수요 풍부 (+22% 매출 견인)</span>
            <p className="text-slate-400 text-[11px]">11:30~13:30 직장인 점심 유동량이 많아 회전율 확보에 유리합니다.</p>
          </div>
          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-emerald-500/20 space-y-1">
            <span className="text-emerald-400 font-bold block">3. 적정 평당 임대료 수준 (+15% 수익성 보호)</span>
            <p className="text-slate-400 text-[11px]">예상 매출 대비 임대료 비중이 9.1%로 안정적 고정비 구조입니다.</p>
          </div>
          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-amber-500/20 space-y-1">
            <span className="text-amber-400 font-bold block">4. 도보 2분 내 경쟁점포 밀집 (-12% 분산 리스크)</span>
            <p className="text-slate-400 text-[11px]">인근 동종 업체 밀집으로 단골 할인 및 정기 쿠폰제 운영이 권장됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
