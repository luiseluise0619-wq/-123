import os
import json
from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.core.config import settings

class RAGKnowledgeEngine:
    """
    Metadata-filtered Vector Store & Cosine Similarity Knowledge Retriever.
    Reads documents from backend/app/knowledge/ and provides context for Gemini LLM.
    """
    def __init__(self):
        self.documents: List[Dict[str, Any]] = []
        self.vectorizer = TfidfVectorizer()
        self._load_knowledge_base()

    def _load_knowledge_base(self):
        self.documents = []
        knowledge_dir = settings.KNOWLEDGE_DIR
        
        if os.path.exists(knowledge_dir):
            for root, _, files in os.walk(knowledge_dir):
                for file in files:
                    if file.endswith(".json"):
                        filepath = os.path.join(root, file)
                        try:
                            with open(filepath, "r", encoding="utf-8") as f:
                                docs = json.load(f)
                                if isinstance(docs, list):
                                    self.documents.extend(docs)
                        except Exception as e:
                            print(f"RAG document load error ({file}): {e}")
                            
        # Built-in fallback docs if empty
        if not self.documents:
            self.documents = [
                {
                    "id": "fallback_01",
                    "title": "2026 서울시 소상공인 창업 자금 지원 정책",
                    "category": "startup_policy",
                    "industry": "전업종",
                    "region": "서울",
                    "summary": "신규 소상공인 창업자 대상 최대 5,000만원 저리 융자(연 2.0%) 및 초기 3개월 임대료 20% 보조금 지급."
                },
                {
                    "id": "fallback_02",
                    "title": "카페/디저트 상권 피크타임 회전율 가이드",
                    "category": "industry",
                    "industry": "카페/디저트",
                    "region": "서울",
                    "summary": "20~30대 유동량이 높은 상권에서는 출근시간(8~10시) 및 점심시간(11:30~13:30) 피크타임 회전율 확보가 중요합니다."
                }
            ]

    def retrieve_relevant_context(self, query: str = "", industry: str = "카페/디저트", top_k: int = 2) -> List[Dict[str, Any]]:
        # 1. Metadata Pre-Filtering
        filtered_docs = []
        for doc in self.documents:
            doc_ind = doc.get("industry", "전업종")
            if doc_ind == "전업종" or doc_ind in industry or industry in doc_ind:
                filtered_docs.append(doc)
                
        if not filtered_docs:
            filtered_docs = self.documents
            
        # 2. Vector Similarity Scoring
        try:
            texts = [f"{d['title']} {d['summary']}" for d in filtered_docs]
            if query:
                search_texts = texts + [query]
                tfidf_matrix = self.vectorizer.fit_transform(search_texts)
                query_vector = tfidf_matrix[-1]
                doc_vectors = tfidf_matrix[:-1]
                
                similarities = cosine_similarity(query_vector, doc_vectors)[0]
                
                indexed_docs = []
                for idx, sim in enumerate(similarities):
                    doc_copy = dict(filtered_docs[idx])
                    doc_copy["similarity_score"] = round(float(sim), 4)
                    indexed_docs.append(doc_copy)
                    
                indexed_docs.sort(key=lambda x: x["similarity_score"], reverse=True)
                return indexed_docs[:top_k]
        except Exception as e:
            print(f"Vector search warning: {e}")
            
        return filtered_docs[:top_k]

rag_engine = RAGKnowledgeEngine()
