# AI Local Intelligence - Enterprise AI Commercial Intelligence SaaS Platform

**AI Local Intelligence**는 수십 가지 상권 인구, 유동량, 카드 소비, 임대료 데이터를 바탕으로 창업 성공 가능성과 매출을 예측하고, SHAP 설명가능한 AI(XAI)와 "What-If" 가상 시뮬레이션을 제공하는 **기업/투자자/창업자용 AI 상권 의사결정 인텔리전스 플랫폼**입니다.

---

## 🌟 핵심 스펙 & 아키텍처

1. **Multi-Model Machine Learning Engine (`backend/app/ml/`)**:
   - **예상 월 매출**: LightGBM Regressor (RMSE, MAE, R² 검증)
   - **창업 성공 확률**: LightGBM Classifier (86.4% 성공률 추정)
   - **폐업 리스크**: LightGBM Multi-Class Classifier (LOW / MEDIUM / HIGH)
2. **SHAP Explainable AI (XAI)**:
   - 예측 수치에 가장 긍정적/부정적 영향을 미친 상권 변수 중요도(Feature Importance) 데이터 근거 시각화.
3. **Counterfactual Simulation Engine ("What-If" 가상 시뮬레이터)**:
   - "임대료 20% 감면 시?", "매장 20% 확장 시?" 가상 조건 변경에 따른 **Decision Score (72점 ➔ 81점)** 및 손익 변화 분석.
4. **AI Opportunity Layer Map (`/map`)**:
   - 레드오션(과열)을 피하고 **수요 성장 대비 공급 부족 블루오션 기회 지역(초록색)** 시각화.
5. **RAG Vector Knowledge Base & Gemini AI Consultant (`/chat`)**:
   - 소상공인 지원 정책 및 업종별 성공 가이드북을 벡터 검색으로 결합하여 근거 기반 해설 서빙.
6. **Multi-Persona User Experience**:
   - 창업자 모드 / 투자자 모드 / 지자체 모드 맞춤형 분석 관점 지원.
7. **MLOps Drift Monitoring & Model Registry (`/admin/monitoring`)**:
   - Population Stability Index (PSI) Data Drift 및 Prediction Drift 모니터링 콘솔.

---

## 🚀 시작하기 (Local Setup)

### 1. 백엔드 실행 (FastAPI + ML Pipeline)
```bash
cd backend
python -m venv venv
venv\Scripts\activate # Windows
pip install -r requirements.txt

# ML 모델 학습 및 레지스트리 저장
python -m app.ml.train

# FastAPI 서버 가동
uvicorn app.main:app --port 8000 --reload
```

### 2. 프론트엔드 실행 (Next.js 15 App Router)
```bash
cd frontend
npm install
npm run dev
```

---

## 📂 주요 서비스 루트
- `/` : Gemini 스타일 AI 창업 검색 랜딩
- `/dashboard` : 상권 분석 대시보드
- `/simulator` : AI Startup Simulator ("What-If" 시뮬레이션)
- `/map` : AI Opportunity Map (기회/과열/안정 3색 지도)
- `/report` : AI 상권 분석 리포트 & PDF Export
- `/chat` : Gemini AI 창업 전문 컨설턴트
- `/workspace` : 사용자 창업 프로젝트 저장소 & 시계열 이력 비교 (`/history`)
- `/admin/monitoring` : MLOps 모델 성능 및 Data Drift 어드민 콘솔
