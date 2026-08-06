"""
MLOps 모니터링 API — 실제 지표 서빙 (지어낸 수치 제거).

이전 버전은 모델 성능(r2 0.7287 등)·시스템지표(latency 14.2ms, requests 4250,
memory 245.8)를 하드코딩하고, 데이터가 없으면 가짜 PSI(0.042)로 폴백했다.
이 버전은 학습이 실제로 저장한 registry/v1/metadata.json 의 지표를 읽고, 드리프트는
실데이터로만 계산한다. 데이터/모델이 없으면 지어내지 않고 available=False 로 알린다.
추적하지 않는 시스템지표(지연/요청수/메모리)는 반환하지 않는다.
"""

import json
import os
from fastapi import APIRouter

from app.core.config import settings
from app.ml.psi_tracker import psi_tracker
from app.data.real_data_pipeline import real_data_pipeline

router = APIRouter()

META = os.path.join(settings.MODEL_DIR, "metadata.json")


@router.get("/status")
def get_mlops_monitoring_status():
    # 1) 실제 학습 지표 (train.py 가 저장한 것)
    metrics = None
    if os.path.exists(META):
        try:
            metrics = json.load(open(META, encoding="utf-8"))
        except Exception:
            metrics = None

    # 2) 실데이터로만 드리프트 계산 (없으면 정직하게 미제공)
    drift = None
    try:
        df = real_data_pipeline.load_real_dataset()
        half = len(df) // 2
        if half > 0:
            drift = psi_tracker.audit_data_drift(df.iloc[:half], df.iloc[half:])
    except Exception:
        drift = None

    if metrics is None and drift is None:
        return {"available": False,
                "message": "학습 지표/데이터가 없습니다. `python -m app.ml.train` 실행 후 이용하세요. "
                           "(가짜 지표를 반환하지 않습니다.)"}

    return {
        "available": True,
        "trained_metrics": {  # 실제 저장된 값만
            "revenue": (metrics or {}).get("revenue_metrics"),
            "success": (metrics or {}).get("success_metrics"),
            "risk": (metrics or {}).get("risk_metrics"),
            "split_method": (metrics or {}).get("split_method"),
            "data_provenance": (metrics or {}).get("data_provenance"),
            "trained_records": (metrics or {}).get("n_records"),
        } if metrics else None,
        "data_drift": drift,  # 실계산 or None
        "note": "성능은 학습이 저장한 실제 지표, 드리프트는 실데이터 계산값입니다. "
                "지연/요청수/메모리 등 운영 텔레메트리는 실제로 추적하지 않아 제공하지 않습니다.",
    }
