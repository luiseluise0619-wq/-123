"use client";

import { useState } from "react";
import { MapPin, Navigation, Info, Zap } from "lucide-react";

interface MapZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  opportunity_score: number;
  zone_color: string;
  zone_type: string;
  description: string;
  avg_monthly_sales: string;
  foot_traffic_daily: number;
}

interface MapProps {
  zones?: MapZone[];
}

export function OpportunityMap({ zones }: MapProps) {
  const defaultZones: MapZone[] = zones || [
    {
      id: "z1",
      name: "성수동 카페거리 상권",
      lat: 37.5445,
      lng: 127.0560,
      opportunity_score: 88.5,
      zone_color: "#10b981", // Green (Opportunity)
      zone_type: "GREEN",
      description: "수요 성장 대비 공급 부족 (기회 지역)",
      avg_monthly_sales: "3,850만원",
      foot_traffic_daily: 34000
    },
    {
      id: "z2",
      name: "강남역 메인 상권",
      lat: 37.4979,
      lng: 127.0276,
      opportunity_score: 42.0,
      zone_color: "#ef4444", // Red (Red Ocean)
      zone_type: "RED",
      description: "동일 업종 과밀집 (레드오션 리스크)",
      avg_monthly_sales: "4,200만원",
      foot_traffic_daily: 89000
    },
    {
      id: "z3",
      name: "망원동 포은로 상권",
      lat: 37.5562,
      lng: 126.9015,
      opportunity_score: 82.0,
      zone_color: "#10b981", // Green (Opportunity)
      zone_type: "GREEN",
      description: "관광 유동인구 증가 및 기회 상권",
      avg_monthly_sales: "3,200만원",
      foot_traffic_daily: 21000
    },
    {
      id: "z4",
      name: "홍대입구역 메인 상권",
      lat: 37.5565,
      lng: 126.9244,
      opportunity_score: 58.5,
      zone_color: "#3b82f6", // Blue (Stable)
      zone_type: "BLUE",
      description: "안정적 성숙 상권",
      avg_monthly_sales: "3,900만원",
      foot_traffic_daily: 65000
    }
  ];

  const [activeZone, setActiveZone] = useState<MapZone>(defaultZones[0]);

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <span>AI Opportunity Map (기회 레이어 지도)</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            단순 인기(레드오션)가 아닌 수요 성장 대비 공급 부족 블루오션 기회 지역 탐색
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-xs bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-300">기회 (블루오션)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span className="text-slate-300">경쟁 과열 (레드오션)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span className="text-slate-300">안정 (성숙)</span>
          </div>
        </div>
      </div>

      {/* Interactive Map Visualizer Canvas */}
      <div className="relative w-full h-80 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
        {/* Subtle Map Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

        {/* Map Pins / Heat Hotspots */}
        <div className="absolute inset-0 p-8 flex items-center justify-around">
          {defaultZones.map((zone) => {
            const isSelected = activeZone.id === zone.id;
            return (
              <button
                key={zone.id}
                onClick={() => setActiveZone(zone)}
                className={`relative group transition-transform duration-300 hover:scale-110 ${
                  isSelected ? "scale-125 z-20" : "opacity-80"
                }`}
              >
                {/* Glowing Heat Bubble */}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center blur-md opacity-40 animate-pulse"
                  style={{ backgroundColor: zone.zone_color }}
                />
                
                {/* Center Pin Button */}
                <div
                  className="absolute inset-0 m-auto w-10 h-10 rounded-full border-2 border-white flex flex-col items-center justify-center text-white shadow-xl"
                  style={{ backgroundColor: zone.zone_color }}
                >
                  <MapPin className="w-4 h-4" />
                  <span className="text-[9px] font-black">{zone.opportunity_score}</span>
                </div>

                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-white text-[10px] px-2 py-0.5 rounded border border-slate-700">
                  {zone.name}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Zone Floating Data Popup Card */}
        {activeZone && (
          <div className="absolute top-4 right-4 max-w-xs glass-panel bg-slate-900/95 border border-slate-700 p-4 rounded-xl shadow-2xl z-30">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-white">{activeZone.name}</h4>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: activeZone.zone_color }}
              >
                기회점수 {activeZone.opportunity_score}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mb-3">{activeZone.description}</p>
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 block">예상 월매출</span>
                <span className="font-bold text-emerald-400">{activeZone.avg_monthly_sales}</span>
              </div>
              <div>
                <span className="text-slate-500 block">일 유동인구</span>
                <span className="font-bold text-cyan-400">{activeZone.foot_traffic_daily.toLocaleString()}명</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
