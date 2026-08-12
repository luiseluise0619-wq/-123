"""
AegisAI local security-auditing API.

This module intentionally reports only results returned by the local analysis
pipeline. It never clones repository URLs, executes submitted source code, or
claims that header values constitute production authentication.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import datetime as dt
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.inference import ModelInferenceEngine
from security_ai_core import reasoning_agent
from security_engine.integrated_auditor import AuditReport, IntegratedSecurityAuditor
from security_engine.red_blue_arena import LocalRiskModel, RedBlueTrainingArena
from security_engine.repository_trainer import RepositoryRiskTrainer
from security_engine.public_corpus_trainer import PublicVulnerabilityCorpusTrainer
from security_engine.blue_team_evaluator import BlueTeamEvaluator
from security_engine.strong_model_registry import StrongModelRegistry, StrongPythonRiskAdapter
from security_engine.korean_red_team_generator import KoreanRedTeamGenerator


app = FastAPI(
    title="AegisAI Security Auditor",
    version="1.1.0",
    description=(
        "Local Python source-code security auditing API. It runs the repository's "
        "real static-analysis and optional safe-patch pipeline; it does not execute "
        "submitted code or perform repository cloning."
    ),
)

MAX_SOURCE_BYTES = 200_000


class UserRole:
    """Roles accepted by the local, header-driven development context."""

    ADMIN = "Admin"
    SECURITY_LEAD = "Security Lead"
    DEVELOPER = "Developer"
    ALL = {ADMIN, SECURITY_LEAD, DEVELOPER}


class RequestContext(BaseModel):
    """Validated request context for local development only, not authentication."""

    organization_id: str
    user_email: str
    user_role: str


class AuditLogEntry(BaseModel):
    audit_id: str = Field(default_factory=lambda: f"AUD-{int(time.time() * 1000)}")
    timestamp: str = Field(
        default_factory=lambda: dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    )
    organization_id: str
    user_email: str
    user_role: str
    action: str
    target_type: str
    ip_address: str
    details: str


class CodeAuditRequest(BaseModel):
    """A local, non-executed Python source audit request."""

    source_code: str = Field(
        min_length=1,
        max_length=MAX_SOURCE_BYTES,
        description="Python source to statically analyze. It is not executed or persisted.",
    )
    language: Literal["python"] = "python"
    apply_safe_fixes: bool = Field(
        default=True,
        description="Apply only deterministic fixes, then verify them by re-scanning.",
    )


class CodeAuditResponse(BaseModel):
    """Report derived from real scanner and re-scan output."""

    audit: AuditReport
    source_persisted: bool = False
    analysis_scope: str = "static analysis only; submitted code was not executed"


class LegacyRepositoryAuditRequest(BaseModel):
    repository_url: str
    target_type: str = "Web"
    branch: str = "main"


class CVEfixesEvaluationRequest(BaseModel):
    """Bounded evaluation request for an official CVEfixes SQLite database."""

    database_filename: str = Field(default="CVEfixes.db", min_length=1, max_length=255)
    minimum_recall: float = Field(default=0.80, gt=0, le=1)
    pair_limit: Optional[int] = Field(default=None, ge=3, le=50000)
    scenario_ids: Optional[List[str]] = Field(default=None, max_length=16)


class StrongModelPredictionRequest(BaseModel):
    source_code: str = Field(min_length=1, max_length=MAX_SOURCE_BYTES)
    language: Literal["python", "c_cpp"]


class RedBlueTrainingRequest(BaseModel):
    """Bounded request for local, non-executed Red-Team / Blue-Team exercises."""

    rounds: int = Field(default=4, ge=1, le=16)
    training_corpus: Literal["repository", "public-github-vulnerability", "strong-language-models"] = "repository"
    retrain_model: bool = Field(
        default=True,
        description="Rebuild the selected local risk model before the exercises.",
    )


class KoreanScenarioRequest(BaseModel):
    """Request for a Korean, metadata-only Red-Team scenario."""

    category: Optional[str] = Field(default=None, max_length=80)


class KoreanArenaRequest(BaseModel):
    """Bounded Korean scenario rounds; no code is executed or sent to a target."""

    rounds: int = Field(default=4, ge=1, le=16)


# Deliberately in-memory local state. Raw submitted source is never retained.
AUDIT_LOG_TRAIL: List[AuditLogEntry] = []
AUDIT_REPORTS: Dict[str, Dict[str, Any]] = {}
TRAINING_ARENA = RedBlueTrainingArena()
REPOSITORY_TRAINING_MODELS: Dict[str, LocalRiskModel] = {}
REPOSITORY_TRAINING_REPORTS: Dict[str, Dict[str, Any]] = {}
PUBLIC_CORPUS_TRAINING_MODELS: Dict[str, LocalRiskModel] = {}
PUBLIC_CORPUS_TRAINING_REPORTS: Dict[str, Dict[str, Any]] = {}
TRAINING_DASHBOARDS: Dict[str, Dict[str, Any]] = {}
CVEFIXES_EVALUATION_DASHBOARDS: Dict[str, Dict[str, Any]] = {}
CVEFIXES_DATA_ROOT = (PROJECT_ROOT.parent / "cvedata").resolve()
STRONG_MODEL_ROOT = PROJECT_ROOT / "models" / "strong_v1"
MASSIVE_REPORT_PATH = PROJECT_ROOT / "models" / "massive_v1" / "massive_kr_report.json"
SYNC_REPORT_PATH = PROJECT_ROOT / "models" / "extreme_v1" / "synchronized_dual_report.json"
ADVERSARIAL_REPORT_PATH = PROJECT_ROOT / "models" / "extreme_v1" / "detailed_adversarial_report.json"
FEEDBACK_REPORT_PATH = PROJECT_ROOT / "models" / "extreme_v1" / "adversarial_feedback_report.json"
STRONG_MODEL_REGISTRY: Optional[StrongModelRegistry] = None
KOREAN_RED_TEAM = KoreanRedTeamGenerator(seed=42)


def get_request_context(
    x_org_id: str = Header(..., alias="X-Org-Id", min_length=1, max_length=128),
    x_user_email: str = Header(..., alias="X-User-Email", min_length=3, max_length=320),
    x_user_role: str = Header(..., alias="X-User-Role", min_length=1, max_length=64),
) -> RequestContext:
    """Validate a development request context.

    The values are caller-provided headers and are therefore not production-grade
    authentication. A deployment must replace this dependency with verified OIDC,
    session, or API-key authentication before exposing the service publicly.
    """
    if x_user_role not in UserRole.ALL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid local development role.",
        )
    return RequestContext(
        organization_id=x_org_id,
        user_email=x_user_email,
        user_role=x_user_role,
    )


def record_audit_event(
    context: RequestContext,
    request: Request,
    action: str,
    target_type: str,
    details: str,
) -> None:
    """Record local metadata only; raw source code is intentionally excluded."""
    client_ip = request.client.host if request.client else "unknown"
    AUDIT_LOG_TRAIL.append(
        AuditLogEntry(
            organization_id=context.organization_id,
            user_email=context.user_email,
            user_role=context.user_role,
            action=action,
            target_type=target_type,
            ip_address=client_ip,
            details=details,
        )
    )


def _stored_report(audit: AuditReport, organization_id: str) -> Dict[str, Any]:
    """Persist an audit report without retaining original or patched source code."""
    report = audit.model_dump()
    report["patched_code"] = None
    return {"organization_id": organization_id, "audit": report}


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok", "service": "aegisai-local-security-auditor"}


@app.get("/dashboard", include_in_schema=False)
async def training_dashboard() -> FileResponse:
    """Serve the local Red-Team / Blue-Team training dashboard."""
    return FileResponse(PROJECT_ROOT / "training_dashboard.html")


@app.get("/blue-dashboard", include_in_schema=False)
async def blue_team_dashboard() -> FileResponse:
    """Serve the CVEfixes Blue-Team evaluation dashboard."""
    return FileResponse(PROJECT_ROOT / "blue_team_dashboard.html")


@app.post("/api/v1/audit-code", response_model=CodeAuditResponse)
async def audit_python_source(
    payload: CodeAuditRequest,
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> CodeAuditResponse:
    """Run a static audit on inline Python source without executing or saving it."""
    source_size = len(payload.source_code.encode("utf-8"))
    if source_size > MAX_SOURCE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"source_code exceeds the {MAX_SOURCE_BYTES}-byte local analysis limit.",
        )

    try:
        if payload.apply_safe_fixes:
            audit = IntegratedSecurityAuditor().run_full_audit(payload.source_code)
        else:
            prediction = ModelInferenceEngine().predict(payload.source_code)
            findings = [finding.model_dump() for finding in prediction.findings]
            audit = AuditReport(
                audit_id=f"AUD-{int(time.time() * 1000)}",
                timestamp_utc=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                engine=prediction.engine,
                findings_count=prediction.num_findings,
                findings=findings,
                model_available=prediction.model_available,
                model_vuln_probability=prediction.model_vuln_probability,
                patch_applied=False,
                patch_needs_llm=False,
                patched_code=None,
                fix_verified_by_rescan=False,
                evidence=None,
                reasoning=[
                    reasoning_agent(
                        {
                            "rule_id": finding["rule_id"],
                            "cwe": finding.get("cwe"),
                            "message": finding.get("message"),
                        }
                    )
                    for finding in findings
                ],
            )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The Bandit static-analysis executable is unavailable on this server.",
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Static analysis exceeded the configured time limit.",
        ) from exc

    AUDIT_REPORTS[audit.audit_id] = _stored_report(audit, context.organization_id)
    record_audit_event(
        context=context,
        request=request,
        action="AUDIT_INLINE_PYTHON",
        target_type="Python",
        details=(
            f"audit_id={audit.audit_id}; findings={audit.findings_count}; "
            f"safe_patch_applied={audit.patch_applied}; source_bytes={source_size}"
        ),
    )
    return CodeAuditResponse(audit=audit)


@app.post("/api/v1/blue-team/evaluate")
async def evaluate_cvefixes_blue_team(
    payload: CVEfixesEvaluationRequest,
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Evaluate local CVEfixes method pairs and simulate approved local scenarios."""
    if context.user_role not in {UserRole.ADMIN, UserRole.SECURITY_LEAD}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CVEfixes model evaluation requires the Admin or Security Lead role.",
        )
    database_path = (CVEFIXES_DATA_ROOT / payload.database_filename).resolve()
    if CVEFIXES_DATA_ROOT not in database_path.parents or database_path.suffix != ".db":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="database_filename must reference a .db file under the local cvedata directory.",
        )
    try:
        evaluator = BlueTeamEvaluator(
            str(database_path),
            minimum_recall=payload.minimum_recall,
            limit=payload.pair_limit,
        )
        training = evaluator.train()
        patch_evaluation = evaluator.evaluate_patch_detection()
        simulation = evaluator.simulate_red_team_response(payload.scenario_ids)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CVEfixes database not found. Convert the official dump and place the .db file under cvedata/.",
        ) from exc
    except (ValueError, sqlite3.DatabaseError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"CVEfixes evaluation could not use this database: {str(exc)}",
        ) from exc

    result = {
        "training": training,
        "patch_evaluation": patch_evaluation,
        "red_blue_simulation": simulation,
    }
    CVEFIXES_EVALUATION_DASHBOARDS[context.organization_id] = result
    record_audit_event(
        context=context,
        request=request,
        action="EVALUATE_CVEFIXES_BLUE_TEAM",
        target_type="LocalCVEfixesDatabase",
        details=(
            f"pair_limit={payload.pair_limit or 'all'}; minimum_recall={payload.minimum_recall}; "
            f"evaluated_pairs={patch_evaluation['overall']['patch_pairs_evaluated']}"
        ),
    )
    return result


@app.get("/api/v1/blue-team/dashboard")
async def get_cvefixes_blue_dashboard(
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Return the latest in-memory CVEfixes Blue-Team evaluation for one organization."""
    result = CVEFIXES_EVALUATION_DASHBOARDS.get(context.organization_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No CVEfixes Blue-Team evaluation exists for this organization yet.",
        )
    record_audit_event(
        context=context,
        request=request,
        action="READ_CVEFIXES_BLUE_DASHBOARD",
        target_type="LocalCVEfixesDatabase",
        details="Returned latest aggregate model evaluation and Red-Team response simulation.",
    )
    return result


@app.get("/api/v1/strong-models/report")
async def get_strong_model_report(
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Return metadata and aggregate metrics for locally trained strong models."""
    global STRONG_MODEL_REGISTRY
    try:
        if STRONG_MODEL_REGISTRY is None:
            STRONG_MODEL_REGISTRY = StrongModelRegistry(STRONG_MODEL_ROOT)
            STRONG_MODEL_REGISTRY.load()
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    record_audit_event(
        context=context,
        request=request,
        action="READ_STRONG_MODEL_REPORT",
        target_type="LocalStrongModel",
        details=f"languages={','.join(sorted(STRONG_MODEL_REGISTRY.models))}",
    )
    return STRONG_MODEL_REGISTRY.metadata()


@app.post("/api/v1/strong-models/predict")
async def predict_with_strong_model(
    payload: StrongModelPredictionRequest,
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Score submitted source with a strong local model without storing or executing it."""
    global STRONG_MODEL_REGISTRY
    try:
        if STRONG_MODEL_REGISTRY is None:
            STRONG_MODEL_REGISTRY = StrongModelRegistry(STRONG_MODEL_ROOT)
            STRONG_MODEL_REGISTRY.load()
        result = STRONG_MODEL_REGISTRY.predict(payload.source_code, payload.language)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    record_audit_event(
        context=context,
        request=request,
        action="PREDICT_STRONG_MODEL",
        target_type=payload.language,
        details=f"model_available={result.get('model_available', False)}; source_bytes={len(payload.source_code.encode('utf-8'))}",
    )
    result["source_persisted"] = False
    return result


@app.post("/api/v1/training/red-blue")
async def run_red_blue_training(
    payload: RedBlueTrainingRequest,
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Run safe, local security exercises; no targets are attacked or executed."""
    try:
        if payload.training_corpus == "public-github-vulnerability":
            if payload.retrain_model or context.organization_id not in PUBLIC_CORPUS_TRAINING_MODELS:
                model, training_report = PublicVulnerabilityCorpusTrainer(PROJECT_ROOT.parent / "cvedata").train()
                PUBLIC_CORPUS_TRAINING_MODELS[context.organization_id] = model
                PUBLIC_CORPUS_TRAINING_REPORTS[context.organization_id] = training_report
            else:
                model = PUBLIC_CORPUS_TRAINING_MODELS[context.organization_id]
                training_report = PUBLIC_CORPUS_TRAINING_REPORTS[context.organization_id]
        elif payload.training_corpus == "strong-language-models":
            global STRONG_MODEL_REGISTRY
            if STRONG_MODEL_REGISTRY is None:
                STRONG_MODEL_REGISTRY = StrongModelRegistry(STRONG_MODEL_ROOT)
                STRONG_MODEL_REGISTRY.load()
            model = StrongPythonRiskAdapter(STRONG_MODEL_REGISTRY)
            training_report = STRONG_MODEL_REGISTRY.metadata()
        else:
            if payload.retrain_model or context.organization_id not in REPOSITORY_TRAINING_MODELS:
                model, training_report = RepositoryRiskTrainer(PROJECT_ROOT).train()
                REPOSITORY_TRAINING_MODELS[context.organization_id] = model
                REPOSITORY_TRAINING_REPORTS[context.organization_id] = training_report
            else:
                model = REPOSITORY_TRAINING_MODELS[context.organization_id]
                training_report = REPOSITORY_TRAINING_REPORTS[context.organization_id]

        # The selected model ranks local exercises. Bandit remains the sole
        # judge for findings, red-team validity, blue-team patches, and scores.
        TRAINING_ARENA.risk_model = model
        result = TRAINING_ARENA.run_rounds(
            rounds=payload.rounds,
            retrain_model=False,
        )
        result["training_corpus"] = payload.training_corpus
        result["training_report"] = training_report
        # Backward-compatible key for existing dashboard clients.
        result["repository_training"] = training_report
        TRAINING_DASHBOARDS[context.organization_id] = result
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The Bandit static-analysis executable is unavailable on this server.",
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Static analysis exceeded the configured time limit.",
        ) from exc

    record_audit_event(
        context=context,
        request=request,
        action="RUN_SAFE_RED_BLUE_TRAINING",
        target_type="LocalCodeTraining",
        details=(
            f"corpus={payload.training_corpus}; rounds={payload.rounds}; "
            f"red_points={result['scoreboard']['red_points']}; "
            f"blue_points={result['scoreboard']['blue_points']}; "
            f"judge_verified_fixes={result['scoreboard']['judge_verified_fixes']}"
        ),
    )
    return result


@app.get("/api/v1/massive-models/report")
async def get_massive_model_report(
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Return actual 10M target and processed-row progress, never a fabricated count."""
    if MASSIVE_REPORT_PATH.exists():
        try:
            report = json.loads(MASSIVE_REPORT_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=503, detail="Massive model progress report is invalid.") from exc
    else:
        report = {
            "data_scale_target": 10_000_000,
            "stream_progress": {
                "target_samples": 10_000_000,
                "processed_samples": 0,
                "target_reached": False,
                "completion_ratio": 0.0,
                "scale_status": "not_started",
            },
            "rounds": [],
        }
    record_audit_event(
        context=context,
        request=request,
        action="READ_MASSIVE_MODEL_PROGRESS",
        target_type="LocalTraining",
        details=f"processed_samples={report.get('stream_progress', {}).get('processed_samples', 0)}",
    )
    return report


@app.get("/api/v1/synchronized-training/report")
async def get_synchronized_training_report(
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Return simultaneous Red-Team and Blue-Team training progress."""
    if SYNC_REPORT_PATH.exists():
        try:
            report = json.loads(SYNC_REPORT_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=503, detail="Synchronized report is invalid.") from exc
    else:
        report = {
            "status": "not_started",
            "red_team": {"processed_samples": 0, "target_samples": 10_000_000, "completion_ratio": 0.0},
            "blue_team": {"processed_samples": 0, "target_samples": 10_000_000, "completion_ratio": 0.0},
            "recent_exchanges": [],
            "safety_scope": "static analysis only; no code execution",
        }
    record_audit_event(
        context=context,
        request=request,
        action="READ_SYNCHRONIZED_TRAINING_REPORT",
        target_type="SynchronizedTraining",
        details="Returned synchronized Red/Blue training report.",
    )
    return report


@app.get("/api/v1/adversarial-report")
async def get_adversarial_report(
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Return high-fidelity Red-Blue simulation logs and CWE distribution."""
    if ADVERSARIAL_REPORT_PATH.exists():
        try:
            return json.loads(ADVERSARIAL_REPORT_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=503, detail="Adversarial report is invalid.") from exc
    return {
        "dataset_analysis": {"total_samples": 0, "cwe_distribution": []},
        "adversarial_simulation": {"total_rounds": 0, "logs": []}
    }


@app.get("/api/v1/adversarial-feedback/report")
async def get_adversarial_feedback_report(
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Return evolution metrics from millions of adversarial feedback rounds."""
    if FEEDBACK_REPORT_PATH.exists():
        try:
            return json.loads(FEEDBACK_REPORT_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=503, detail="Feedback report is invalid.") from exc
    return {
        "status": "not_started",
        "completed_rounds": 0,
        "target_rounds": 1_000_000,
        "evolution_history": [],
        "safety_scope": "static analysis only; no code execution",
    }


@app.post("/api/v1/korean-scenarios/generate")
async def generate_korean_scenario(
    payload: KoreanScenarioRequest,
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Generate a bounded Korean Red-Team scenario without delivering an attack."""
    result = KOREAN_RED_TEAM.generate_scenario(payload.category)
    record_audit_event(
        context=context,
        request=request,
        action="GENERATE_KOREAN_RED_TEAM_SCENARIO",
        target_type="LocalTrainingScenario",
        details=f"category={payload.category or 'any'}; scenario_id={result['scenario']['id']}",
    )
    return result


@app.post("/api/v1/korean-scenarios/arena")
async def run_korean_scenario_arena(
    payload: KoreanArenaRequest,
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Generate Korean scenarios and hand them to the static Blue-Team workflow."""
    result = KOREAN_RED_TEAM.run_rounds(payload.rounds)
    record_audit_event(
        context=context,
        request=request,
        action="RUN_KOREAN_RED_BLUE_SCENARIOS",
        target_type="LocalCodeTraining",
        details=f"rounds={payload.rounds}; source_executed=false; network_contacted=false",
    )
    return {"organization_id": context.organization_id, **result}


@app.get("/api/v1/training/dashboard")
async def get_training_dashboard(
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Return the latest repository-trained local dashboard data for one organization."""
    dashboard = TRAINING_DASHBOARDS.get(context.organization_id)
    if dashboard is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Red-Team / Blue-Team training result exists for this organization yet.",
        )
    record_audit_event(
        context=context,
        request=request,
        action="READ_RED_BLUE_DASHBOARD",
        target_type="LocalCodeTraining",
        details="Returned latest repository-backed training dashboard data.",
    )
    return dashboard


@app.post("/api/v1/audit", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def legacy_repository_audit(
    payload: LegacyRepositoryAuditRequest,
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, str]:
    """Explicitly reject the former hard-coded repository-audit demonstration."""
    record_audit_event(
        context=context,
        request=request,
        action="REJECTED_REPOSITORY_AUDIT",
        target_type=payload.target_type,
        details="Repository cloning is not implemented; no audit was performed.",
    )
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Repository URL auditing is not implemented in this local API, so no audit "
            "was performed. Submit inline Python source to /api/v1/audit-code instead."
        ),
    )


@app.get("/api/v1/audits/{audit_id}")
async def get_audit(
    audit_id: str,
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Return a previously created local report for the requesting organization."""
    stored = AUDIT_REPORTS.get(audit_id)
    if not stored or stored["organization_id"] != context.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit report not found.")
    record_audit_event(
        context=context,
        request=request,
        action="READ_AUDIT",
        target_type="Python",
        details=f"audit_id={audit_id}",
    )
    return stored["audit"]


@app.get("/api/v1/findings")
async def list_findings(
    request: Request,
    severity: Optional[str] = Query(default=None, max_length=16),
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Return real findings from locally submitted audits scoped by organization."""
    requested_severity = severity.upper() if severity else None
    findings: List[Dict[str, Any]] = []
    for audit_id, stored in AUDIT_REPORTS.items():
        if stored["organization_id"] != context.organization_id:
            continue
        for finding in stored["audit"]["findings"]:
            if requested_severity and finding["severity"].upper() != requested_severity:
                continue
            findings.append({"audit_id": audit_id, **finding})

    record_audit_event(
        context=context,
        request=request,
        action="LIST_FINDINGS",
        target_type="Python",
        details=f"severity_filter={requested_severity or 'none'}; count={len(findings)}",
    )
    return {
        "organization_id": context.organization_id,
        "total_findings": len(findings),
        "findings": findings,
    }


@app.get("/api/v1/reports")
async def get_audit_reports(
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """List actual reports produced during this process lifetime."""
    reports = [
        {
            "audit_id": audit_id,
            "timestamp_utc": stored["audit"]["timestamp_utc"],
            "findings_count": stored["audit"]["findings_count"],
            "patch_applied": stored["audit"]["patch_applied"],
            "fix_verified_by_rescan": stored["audit"]["fix_verified_by_rescan"],
        }
        for audit_id, stored in AUDIT_REPORTS.items()
        if stored["organization_id"] == context.organization_id
    ]
    record_audit_event(
        context=context,
        request=request,
        action="LIST_AUDIT_REPORTS",
        target_type="Python",
        details=f"count={len(reports)}",
    )
    return {"organization_id": context.organization_id, "available_reports": reports}


@app.get("/api/v1/audit-logs")
async def get_audit_trail(
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Return the local audit trail to an Admin or Security Lead only."""
    if context.user_role not in {UserRole.ADMIN, UserRole.SECURITY_LEAD}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Audit-log access requires the Admin or Security Lead role.",
        )
    org_logs = [entry.model_dump() for entry in AUDIT_LOG_TRAIL if entry.organization_id == context.organization_id]
    record_audit_event(
        context=context,
        request=request,
        action="READ_AUDIT_LOGS",
        target_type="AuditLog",
        details=f"count={len(org_logs)}",
    )
    return {
        "organization_id": context.organization_id,
        "total_log_entries": len(org_logs),
        "audit_trail": org_logs,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
