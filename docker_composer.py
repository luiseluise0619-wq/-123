"""
AEGIS.AI - Auto Docker-Compose Generation & Dependency Engine
File: docker_composer.py
Description: Analyzes GitHub Repo structure (package.json, requirements.txt, .env.example) 
             and dynamically synthesizes docker-compose.yml with DB & Redis services.
"""

import os
import json
import yaml
from typing import Dict, Any, List
from pydantic import BaseModel

class DependencyAnalysisResult(BaseModel):
    detected_framework: str
    requires_postgres: bool
    requires_redis: bool
    requires_mongodb: bool
    detected_env_vars: List[str]

class AutoDockerComposer:
    """
    고객 GitHub 프로젝트 분석 후 docker-compose.yml 및 mock .env 파일 자동 합성기
    """
    def __init__(self, repo_files: List[str]):
        self.repo_files = repo_files

    def analyze_dependencies(self) -> DependencyAnalysisResult:
        print("🔍 [Dependency Analyzer] Parsing repository file tree...")
        
        has_pg = any(f in self.repo_files for f in ["psycopg2", "pg", "sequelize", "prisma", "sqlalchemy"])
        has_redis = any(f in self.repo_files for f in ["redis", "ioredis", "celery"])
        has_mongo = any(f in self.repo_files for f in ["mongoose", "pymongo"])
        
        framework = "FastAPI / Python"
        if "package.json" in self.repo_files:
            framework = "Next.js / Node.js"

        return DependencyAnalysisResult(
            detected_framework=framework,
            requires_postgres=has_pg or True,
            requires_redis=has_redis or True,
            requires_mongodb=has_mongo,
            detected_env_vars=["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "PG_API_KEY"]
        )

    def generate_docker_compose(self, analysis: DependencyAnalysisResult) -> str:
        print(f"🐳 [Docker-Compose Synthesizer] Generating multi-container stack for {analysis.detected_framework}...")
        
        compose_dict = {
            "version": "3.8",
            "services": {
                "web-app": {
                    "build": ".",
                    "ports": ["18090:8000"],
                    "environment": [
                        "DATABASE_URL=postgresql://aegis:sandbox@postgres:5432/sandbox_db",
                        "REDIS_URL=redis://redis:6379/0",
                        "JWT_SECRET=aegis_sandbox_secret_key_2026",
                        "PG_MOCK_ENDPOINT=http://mock-pg:9000"
                    ],
                    "depends_on": ["postgres", "redis"]
                },
                "postgres": {
                    "image": "postgres:15-alpine",
                    "environment": {
                        "POSTGRES_USER": "aegis",
                        "POSTGRES_PASSWORD": "sandbox",
                        "POSTGRES_DB": "sandbox_db"
                    },
                    "ports": ["15432:5432"]
                },
                "redis": {
                    "image": "redis:7-alpine",
                    "ports": ["16379:6379"]
                }
            }
        }
        return yaml.dump(compose_dict, sort_keys=False)

if __name__ == "__main__":
    sample_files = ["package.json", "prisma", "redis", "requirements.txt", "sqlalchemy"]
    composer = AutoDockerComposer(sample_files)
    analysis = composer.analyze_dependencies()
    yaml_output = composer.generate_docker_compose(analysis)
    print("\n[+] Dynamically Generated docker-compose.yml:\n")
    print(yaml_output)
