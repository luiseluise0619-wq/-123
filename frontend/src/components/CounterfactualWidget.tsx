"use client";

import { useState } from "react";
import { Sliders, ArrowRight, Sparkles } from "lucide-react";

interface CounterfactualProps {
  originalScore: number;
  originalRevenue: number;
  onSimulate?: (rentPct: number, floorPct: number) => void;
}

export function CounterfactualWidget({ originalScore, originalRevenue }: CounterfactualProps) {
  const [rentChange, setRentChange] = useState<number>(-20); // -20% rent
  const [floorChange, setFloorChange] = useState<number>(20); // +20% size

  // Simulated metrics
  const scoreDelta = (rentChange * -0.15) + (floorChange * 0.10);
  const simulatedScore = Math.min(99.0, Math.max(30.0, +(originalScore + scoreDelta).toFixed(1)));
  const simulatedRevenue = Math.round(originalRevenue * (1.0 + (floorChange * 0.0045)));

  return (
    <div className="glass-panel rounded-2xl p-6 border border-cyan-500/20 bg-gradient-to-b from-slate-900/80 to-slate-950/80">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-white">AI Counterfactual Simulator ("What-If" 가상 시뮬레이션)</h3>
        </div>
        <span className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
          조건 변경 시 손익 변동 계산
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
        {/* Slider 1: Rent Change */}
        <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">임대료 조정 비율</span>
            <span className="font-bold text-cyan-400">{rentChange > 0 ? `+${rentChange}%` : `${rentChange}%`}</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="5"
            value={rentChange}
            onChange={(e) => setRentChange(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>-50% (임대료 반값)</span>
            <span>0% (현재)</span>
            <span>+50% (임대료 인상)</span>
          </div>
        </div>

        {/* Slider 2: Floor Area Expansion */}
        <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">매장 면적 변경 비율</span>
            <span className="font-bold text-cyan-400">{floorChange > 0 ? `+${floorChange}%` : `${floorChange}%`}</span>
          </div>
          <input
            type="range"
            min="-30"
            max="50"
            step="5"
            value={floorChange}
            onChange={(e) => setFloorChange(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>-30% (소형 축소)</span>
            <span>0% (현재 50m²)</span>
            <span>+50% (대형 확장)</span>
          </div>
        </div>
      </div>

      {/* Comparison Results Card */}
      <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/30 border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="text-center">
            <span className="text-[10px] text-slate-400 block">현재 Decision Score</span>
            <span className="text-xl font-bold text-slate-300">{originalScore}점</span>
          </div>
          <ArrowRight className="w-5 h-5 text-cyan-400" />
          <div className="text-center">
            <span className="text-[10px] text-cyan-300 block">가상 변경 후 Decision Score</span>
            <span className="text-2xl font-black text-cyan-400">{simulatedScore}점</span>
          </div>
        </div>

        <div className="text-right border-t md:border-t-0 md:border-l border-slate-800 pt-2 md:pt-0 md:pl-4">
          <div className="text-xs text-slate-400">예상 월 매출액 변동</div>
          <div className="text-lg font-bold text-emerald-400">
            ₩{simulatedRevenue.toLocaleString()}원
          </div>
          <div className="text-[10px] text-cyan-300 mt-0.5">
            점수 변동: {scoreDelta >= 0 ? `+${scoreDelta.toFixed(1)}점 상승` : `${scoreDelta.toFixed(1)}점 하락`}
          </div>
        </div>
      </div>
    </div>
  );
}
