"use client";

import { useState } from "react";
import { Briefcase, Clock, TrendingUp, ArrowRight, FolderPlus } from "lucide-react";

export default function WorkspacePage() {
  const [projects] = useState([
    {
      id: 1,
      title: "성수동 카페 1호점 프로젝트",
      address: "서울시 성동구 성수동2가 300-1",
      industry: "카페/디저트",
      score: 88.5,
      revenue: "3,850만원",
      date: "2026.07.31",
      opportunity: "기회 상권"
    },
    {
      id: 2,
      title: "망원동 테이크아웃점 프로젝트",
      address: "서울시 마포구 망원동 412",
      industry: "카페/디저트",
      score: 83.2,
      revenue: "3,200만원",
      date: "2026.06.15",
      opportunity: "기회 상권"
    }
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl">
            <Briefcase className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">내 AI 창업 워크스페이스</h1>
            <p className="text-xs text-slate-400">저장된 분석 프로젝트 및 시계열 변화(3개월 전 vs 현재)를 추적 관리합니다.</p>
          </div>
        </div>

        <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20">
          <FolderPlus className="w-4 h-4" />
          <span>새 창업 프로젝트 분석</span>
        </button>
      </div>

      {/* Time-Shift Comparative Analysis Widget */}
      <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/20 space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400">
          <Clock className="w-4 h-4" />
          <span>시점 변동 비교 리포트 (3개월 전 vs 현재 성수동 상권)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block">경쟁 점포 변화</span>
            <span className="text-base font-bold text-amber-400">+2개 점포 증가 (12개 ➔ 14개)</span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block">평균 임대료 변동</span>
            <span className="text-base font-bold text-rose-400">+5.7% 임대료 인상</span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block">AI Decision Score</span>
            <span className="text-base font-bold text-cyan-400">+4.5점 상승 (84.0점 ➔ 88.5점)</span>
          </div>
        </div>

        <div className="p-3 bg-slate-950/80 rounded-xl text-xs text-slate-300 border border-slate-800">
          💡 <span className="font-semibold text-cyan-300">인텔리전스 요약:</span> 주변 카페 밀집도 증가 및 임대료 인상에도 불구하고 20대 유동인구 유입 속도가 가속화되어 상권 종합 평가 점수가 지속 상승 중입니다.
        </div>
      </div>

      {/* Saved Projects List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white">저장된 분석 프로젝트 ({projects.length})</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-bold text-white">{p.title}</h3>
                  <span className="text-xs text-slate-400">{p.address}</span>
                </div>
                <span className="text-xs font-black text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/30">
                  {p.score}점
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800 text-slate-400">
                <span>예상 매출: <strong className="text-emerald-400">{p.revenue}</strong></span>
                <span>분석일: {p.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
