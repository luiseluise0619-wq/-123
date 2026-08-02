from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import analysis, simulator, map as map_api, chat, history, monitoring, report, festival
from app.db.database import Base, engine

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(analysis.router, prefix=f"{settings.API_V1_STR}/analysis", tags=["Analysis"])
app.include_router(simulator.router, prefix=f"{settings.API_V1_STR}/simulator", tags=["Simulator"])
app.include_router(map_api.router, prefix=f"{settings.API_V1_STR}/map", tags=["Map"])
app.include_router(chat.router, prefix=f"{settings.API_V1_STR}/chat", tags=["Chat"])
app.include_router(history.router, prefix=f"{settings.API_V1_STR}/history", tags=["History"])
app.include_router(monitoring.router, prefix=f"{settings.API_V1_STR}/monitoring", tags=["Monitoring"])
app.include_router(report.router, prefix=f"{settings.API_V1_STR}/report", tags=["Report"])
app.include_router(festival.router, prefix=f"{settings.API_V1_STR}/festival", tags=["Festival"])

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "demo_mode": settings.DEMO_MODE
    }
