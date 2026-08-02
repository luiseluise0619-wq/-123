import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Local Intelligence"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "ai-local-intelligence-secret-key-2026"
    DEMO_MODE: bool = True

    # 데이터 출처 플래그.
    # 현재 학습/서빙 데이터는 실제 공공데이터가 아니라 통계 분포로 생성한 '합성 데이터'입니다.
    # 실제 공공데이터 API 키를 발급받아 아래 값을 채우고 USE_REAL_DATA=True 로 바꾸면
    # public_api.py 가 진짜 API를 호출합니다. 키가 없으면 자동으로 합성 데이터로 폴백합니다.
    USE_REAL_DATA: bool = os.getenv("USE_REAL_DATA", "false").lower() == "true"

    # DB
    DATABASE_URL: str = "sqlite:///./ai_local_intelligence.db"

    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    MODEL_DIR: str = os.path.join(BASE_DIR, "ml", "registry", "v1")
    KNOWLEDGE_DIR: str = os.path.join(BASE_DIR, "knowledge")

    # --- 공공데이터 API 키 (실제 데이터 연동 시 발급 필요, 모두 무료) ---
    # 서울 열린데이터광장(우리마을가게 상권분석, 서울 생활인구): https://data.seoul.go.kr
    SEOUL_OPENDATA_API_KEY: str = os.getenv("SEOUL_OPENDATA_API_KEY", "")
    # 공공데이터포털(소상공인 상가정보, 국토부 실거래가): https://data.go.kr
    DATA_GO_KR_API_KEY: str = os.getenv("DATA_GO_KR_API_KEY", "")

    # Gemini API Key (Optional with fallback)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()
