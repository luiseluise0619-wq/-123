import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Local Intelligence"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "ai-local-intelligence-secret-key-2026"
    DEMO_MODE: bool = True
    
    # DB
    DATABASE_URL: str = "sqlite:///./ai_local_intelligence.db"
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    MODEL_DIR: str = os.path.join(BASE_DIR, "ml", "registry", "v1")
    KNOWLEDGE_DIR: str = os.path.join(BASE_DIR, "knowledge")
    
    # Gemini API Key (Optional with fallback)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()
