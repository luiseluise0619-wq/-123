"use client";

import { OpportunityMap } from "@/components/OpportunityMap";
import { MapPin, Zap, Shield, AlertCircle } from "lucide-react";

export default function MapPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
          <MapPin className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">AI Opportunity Map (상권 기회 지도)</h1>
          <p className="text-xs text-slate-400">
            인기 레드오션을 넘어 수요 성장 대비 경쟁 공급이 부족한 블루오션 기회 지역을 3색으로 정밀 시각화합니다.
          </p>
        </div>
      </div>

      {/* Main Map Component */}
      <OpportunityMap />

      {/* 3-Color Zone Classification Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
            <Zap className="w-4 h-4" />
            <span>초록색: 기회 지역 (Opportunity)</span>
          </div>
          <p className="text-xs text-slate-300">
            유동인구 및 카드 소비 지출 성장률은 가속화되고 있으나 경쟁 점포 수가 상대적으로 적어 초기 입점 시 높은 매출 달성이 용이한 블루오션 지역입니다.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-rose-500/30 bg-rose-950/10 space-y-2">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>빨간색: 경쟁 과열 (Red Ocean)</span>
          </div>
          <p className="text-xs text-slate-300">
            상권 인지도와 매출 규모는 크지만 동일 업종 밀집도가 포화 상태이며 임대료 및 권리금 부담이 매우 높은 고위험 고수익 지역입니다.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-blue-500/30 bg-blue-950/10 space-y-2">
          <div className="flex items-center space-x-2 text-blue-400 font-bold text-sm">
            <Shield className="w-4 h-4" />
            <span>파란색: 안정적 성숙 상권</span>
          </div>
          <p className="text-xs text-slate-300">
            매출 및 고객 유입이 일정 수준 이상으로 오랫동안 검증되어 변동성이 적고 안정적인 운영이 가능한 고정 고객층 중심 지역입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
