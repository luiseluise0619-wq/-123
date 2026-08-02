"use client";

import { FileText, ShieldCheck, BookOpen, Scale } from "lucide-react";

interface RAGDoc {
  id: string;
  title: string;
  category: string;
  industry: string;
  region: string;
  summary: string;
  similarity_score?: number;
}

interface RAGViewerProps {
  docs?: RAGDoc[];
}

export function RAGKnowledgeViewer({ docs }: RAGViewerProps) {
  const defaultDocs: RAGDoc[] = docs || [
    {
      id: "doc_01",
      title: "2026 서울시 소상공인 창업 융자 지원 및 임대료 보존 정책",
      category: "startup_policy",
      industry: "전업종",
      region: "서울",
      summary: "신규 소상공인 창업자 대상 최대 5,000만원 저리 융자(연 2.0% 금리) 지원 및 초기 3개월 임대료 20% 지원 보조금 정책.",
      similarity_score: 0.942
    },
    {
      id: "doc_02",
      title: "카페/디저트 상권 입지 선정 및 피크타임 동선 전략 가이드",
      category: "industry",
      industry: "카페/디저트",
      region: "서울",
      summary: "20~30대 유동인구가 높은 상권에서는 테이크아웃 피크타임(11:30~13:30) 동선 확보와 직장인 타겟 아침 할인 세트 메뉴 구성이 초기 정착율을 35% 이상 높입니다.",
      similarity_score: 0.885
    }
  ];

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "startup_policy":
        return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
      case "regulation":
        return <Scale className="w-4 h-4 text-purple-400" />;
      default:
        return <BookOpen className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-cyan-500/20 bg-slate-950/60 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-white flex items-center space-x-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span>RAG 벡터 검색 참조 지식베이스 문서 ({defaultDocs.length})</span>
        </h4>
        <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
          Metadata Filtered FAISS
        </span>
      </div>

      <div className="space-y-2.5">
        {defaultDocs.map((doc) => (
          <div key={doc.id} className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                {getCategoryIcon(doc.category)}
                <span>{doc.title}</span>
              </span>
              {doc.similarity_score && (
                <span className="text-[10px] text-emerald-400 font-semibold">
                  유사도 {(doc.similarity_score * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{doc.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
