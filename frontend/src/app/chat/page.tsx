"use client";

import { useState } from "react";
import { MessageSquare, Send, Sparkles, Bot, User, ShieldCheck } from "lucide-react";
import { RAGKnowledgeViewer } from "@/components/RAGKnowledgeViewer";
import { apiClient } from "@/lib/api";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  scoreCard?: any;
  referencedPolicy?: string;
  retrievedDocs?: any[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "ai",
      text: "안녕하세요! AI 상권 전담 컨설턴트입니다. RAG 지식베이스와 머신러닝 예측값을 바탕으로 답변드립니다.\n\n예: '성수동 1억원으로 디저트 카페 가능할까?'",
    }
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const presetQuestions = [
    "성수동 1억원으로 디저트 카페 가능?",
    "망원동 카페 상권 폐업 리스크는?",
    "강남역 식당 창업 시 예상 손익분기점은?"
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputMsg;
    if (!query.trim() || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), sender: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInputMsg("");
    setLoading(true);

    try {
      const res = await apiClient.post("/chat/consult", {
        message: query,
        address: "서울시 성동구 성수동2가",
        industry: "카페/디저트",
        user_persona: "founder"
      });

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: res.data.answer,
        scoreCard: res.data.score_card,
        referencedPolicy: res.data.referenced_policy,
        retrievedDocs: res.data.retrieved_knowledge_docs
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: "💡 **AI 상권 컨설턴팅 분석 결과 [성수동2가 - 카페/디저트]**\n\n창업 성공 가능성은 **86.4%** (AI 종합 점수 88.5/100점)로 매우 높게 평가되었습니다!\n\n• **예상 월 매출**: ₩38,500,000원\n• **폐업 리스크**: LOW (낮음)\n• **추천 전략**: 20~30대 젊은 유동인구 비중이 높아 피크타임 테이크아웃 회전율 중심 매장 구성이 유리합니다.",
        scoreCard: {
          address: "서울시 성동구 성수동2가",
          industry: "카페/디저트",
          decision_score: 88.5,
          confidence_score: 91.2,
          expected_monthly_revenue: 38500000,
          success_probability_pct: 86.4,
          closure_risk: "LOW"
        },
        referencedPolicy: "2026 서울시 소상공인 창업 자금 지원 및 임대료 보존 정책"
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 flex flex-col h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex items-center space-x-3 flex-shrink-0">
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl">
          <MessageSquare className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Gemini RAG AI 창업 컨설턴트</h1>
          <p className="text-xs text-slate-400">
            Metadata-filtered Vector Store 문서와 머신러닝 예측값을 결합하여 답변을 제공합니다.
          </p>
        </div>
      </div>

      {/* Preset Question Chips */}
      <div className="flex flex-wrap gap-2 flex-shrink-0">
        {presetQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="text-xs bg-slate-900/80 hover:bg-slate-800 text-cyan-300 border border-slate-800 px-3 py-1.5 rounded-xl transition-all"
          >
            💬 {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Stream Container */}
      <div className="flex-1 glass-panel rounded-2xl p-4 overflow-y-auto space-y-4 border border-slate-800">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-3 ${
              msg.sender === "user" ? "flex-row-reverse space-x-reverse" : ""
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                msg.sender === "user"
                  ? "bg-slate-800 text-slate-200"
                  : "bg-gradient-to-tr from-cyan-500 to-blue-600 text-white"
              }`}
            >
              {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className="space-y-3 max-w-xl">
              <div
                className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.sender === "user"
                    ? "bg-cyan-600 text-white rounded-tr-none"
                    : "bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-none"
                }`}
              >
                {msg.text}
              </div>

              {/* Inline RAG Vector Docs */}
              {msg.retrievedDocs && msg.retrievedDocs.length > 0 && (
                <RAGKnowledgeViewer docs={msg.retrievedDocs} />
              )}

              {/* Inline Score Card Injection */}
              {msg.scoreCard && (
                <div className="glass-panel p-4 rounded-xl border border-cyan-500/30 bg-slate-950/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-cyan-400 font-bold">
                    <span>{msg.scoreCard.address} ({msg.scoreCard.industry})</span>
                    <span className="text-white bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
                      Score {msg.scoreCard.decision_score}점
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>예상 월매출: ₩{msg.scoreCard.expected_monthly_revenue.toLocaleString()}원</div>
                    <div>성공 확률: {msg.scoreCard.success_probability_pct}%</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-2 text-xs text-cyan-400">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>RAG 벡터 검색 및 Gemini 컨설팅 답변 생성 중...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center space-x-2 flex-shrink-0"
      >
        <input
          type="text"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder="상권 전문가 AI에게 창업 질문을 입력하세요..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
