# Vercel Deployment & Cloud Production Guide

AI Local Intelligence 플랫폼을 Vercel(프론트엔드) 및 클라우드(백엔드)에 배포하기 위한 완전 가이드입니다.

---

## 🚀 1. Vercel 프론트엔드 배포 (Next.js 15)

### Option A: GitHub 연동 (권장)
1. GitHub에 프로젝트 리포지토리 생성 후 푸시:
   ```bash
   git init
   git add .
   git commit -m "feat: Initial AI Local Intelligence release"
   git branch -M main
   git remote add origin <YOUR_GITHUB_REPO_URL>
   git push -u origin main
   ```
2. [Vercel Dashboard](https://vercel.com/dashboard)에 접속 ➔ **Add New Project** 클릭.
3. `frontend` 폴더를 Root Directory로 지정.
4. **Environment Variables** 설정:
   - `NEXT_PUBLIC_API_URL`: `https://your-fastapi-backend.onrender.com/api/v1` (백엔드 배포 주소)
5. **Deploy** 클릭 ➔ 완료! (약 1분 소요)

### Option B: Vercel CLI 배포
```bash
cd frontend
npx vercel
# 프로덕션 배포
npx vercel --prod
```

---

## 🐍 2. Python FastAPI 백엔드 배포

### Option A: Render.com (무료/클라우드)
1. Render.com 접속 ➔ **New Web Service** 선택.
2. GitHub 리포지토리 연동.
3. Root Directory: `backend`
4. Build Command: `pip install -r requirements.txt && python -m app.ml.train`
5. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Option B: Railway.app / Docker
- 루트의 `docker-compose.yml` 및 `backend/Dockerfile`을 사용하여 클릭 한 번으로 배포 가능.

---

## 🌐 3. Vercel 연동 확인 및 시연 주소

배포 후 Vercel이 부여한 URL(예: `https://ai-local-intelligence.vercel.app`)로 접속하시면 세계 어디서나 투자자 및 기관 시연이 가능합니다!
