"use client";

import { User, TrendingUp, Building2 } from "lucide-react";

interface PersonaSwitcherProps {
  currentPersona: string;
  onSelectPersona: (persona: string) => void;
}

export function PersonaSwitcher({ currentPersona, onSelectPersona }: PersonaSwitcherProps) {
  const personas = [
    { id: "founder", label: "창업자 모드", icon: User, desc: "추천 업종 & 손익분기 전략" },
    { id: "investor", label: "투자자 모드", icon: TrendingUp, desc: "상권 상승률 & Cap Rate" },
    { id: "gov", label: "지자체 모드", icon: Building2, desc: "상권 활성화 & 지원 파급효과" }
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {personas.map((p) => {
        const Icon = p.icon;
        const isActive = currentPersona === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelectPersona(p.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs transition-all ${
              isActive
                ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-500/10"
                : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4 text-cyan-400" />
            <div className="text-left">
              <div className="font-semibold">{p.label}</div>
              <div className="text-[10px] text-slate-400 font-normal">{p.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
