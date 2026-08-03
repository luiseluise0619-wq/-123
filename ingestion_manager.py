"""
==============================================================================
AEGIS.AI - Open Source Security Intelligence & Dataset Ingestion Manager
File: ingestion_manager.py
Description: Ingests, categorizes, and synchronizes 28 authoritative security
             vulnerability databases, ML code datasets, rulesets, and benchmark apps.
==============================================================================
"""

import json
from typing import Dict, Any, List
from pydantic import BaseModel

class SecurityRepositorySource(BaseModel):
    id: str
    name: str
    url: str
    category: str  # 'ADVISORY_DB', 'ML_DATASET', 'BENCHMARK_APP', 'RULE_ENGINE', 'FUZZ_PAYLOAD'
    description: str
    target_engine: str

class DatasetIngestionManager:
    """
    Automated Data Pipeline Collector & Ingestion Manager for AegisAI.
    Manages synchronization and parsing of 28 key security open-source projects.
    """
    def __init__(self):
        self.repo_registry: List[SecurityRepositorySource] = [
            # --- 1. Vulnerability & CVE Advisory Intelligence Feeds ---
            SecurityRepositorySource(
                id="SRC-ADV-001", name="GitHub Advisory Database",
                url="https://github.com/github/advisory-database.git",
                category="ADVISORY_DB",
                description="GitHub의 공식 보안 자문 및 CVE/GHSA 취약점 매핑 데이터베이스",
                target_engine="CVE Intelligence Sync"
            ),
            SecurityRepositorySource(
                id="SRC-ADV-002", name="FKIE NVD JSON Data Feeds",
                url="https://github.com/fkie-cad/nvd-json-data-feeds.git",
                category="ADVISORY_DB",
                description="NVD(National Vulnerability Database) 2.0 API 대응 실시간 JSON 피드",
                target_engine="NVD CVE Feed Sync"
            ),
            SecurityRepositorySource(
                id="SRC-ADV-003", name="CVE Project cvelistV5",
                url="https://github.com/CVEProject/cvelistV5.git",
                category="ADVISORY_DB",
                description="공식 CVE 레코드 5세대 (JSON 5.0) 전체 보관소",
                target_engine="CVE Record Indexer"
            ),
            SecurityRepositorySource(
                id="SRC-ADV-004", name="Google OSV.dev Database",
                url="https://github.com/google/osv.dev.git",
                category="ADVISORY_DB",
                description="구글의 오픈소스 취약점(OSV) 분산 데이터베이스 스키마 및 데이터",
                target_engine="Open Source Dependency Advisory"
            ),

            # --- 2. ML Code Datasets & Base Model Architectures ---
            SecurityRepositorySource(
                id="SRC-ML-001", name="MSR 20 Code Vulnerability CSV Dataset",
                url="https://github.com/ZeoVan/MSR_20_Code_vulnerability_CSV_Dataset.git",
                category="ML_DATASET",
                description="MSR 2020 C/C++ 및 Web 소스코드 취약점 딥러닝 학습용 레시피 데이터셋",
                target_engine="CodeBERT Model Fine-Tuning"
            ),
            SecurityRepositorySource(
                id="SRC-ML-002", name="Devign Vulnerability Graph Dataset",
                url="https://github.com/epicosy/devign.git",
                category="ML_DATASET",
                description="Graph Neural Network (GNN) 및 AST 그래프 기반 취약점 탐지 벤치마크",
                target_engine="GraphCodeBERT Feature Extractor"
            ),
            SecurityRepositorySource(
                id="SRC-ML-003", name="Microsoft CodeXGLUE Benchmark",
                url="https://github.com/microsoft/CodeXGLUE.git",
                category="ML_DATASET",
                description="마이크로소프트의 코드 이해 및 취약점 탐지 전용 AI 평가 데이터셋",
                target_engine="Model Benchmark Validator"
            ),
            SecurityRepositorySource(
                id="SRC-ML-004", name="Salesforce CodeT5 Model",
                url="https://github.com/salesforce/CodeT5.git",
                category="ML_DATASET",
                description="코드 구조 인지형 Sequence-to-Sequence AI 시정 코드 생성 모델",
                target_engine="Auto Fix Patch Generator"
            ),
            SecurityRepositorySource(
                id="SRC-ML-005", name="Microsoft CodeBERT Model",
                url="https://github.com/microsoft/CodeBERT.git",
                category="ML_DATASET",
                description="소스코드 시맨틱 및 AST 인지용 트랜스포머 사전학습 모델",
                target_engine="Base Classification Transformer"
            ),
            SecurityRepositorySource(
                id="SRC-ML-006", name="BigCode StarCoder Dataset",
                url="https://github.com/bigcode-project/starcoder.git",
                category="ML_DATASET",
                description="80여 개 프로그래밍 언어 지원 코드 인텔리전스 AI 모델 기반",
                target_engine="Code Comprehension Engine"
            ),

            # --- 3. Vulnerable Web, Mobile & Cloud Benchmark Apps ---
            SecurityRepositorySource(
                id="SRC-APP-001", name="OWASP Juice Shop",
                url="https://github.com/juice-shop/juice-shop.git",
                category="BENCHMARK_APP",
                description="Modern Node.js/Angular 기반 OWASP Top 10 시뮬레이션 웹 앱",
                target_engine="Web DAST & Business Logic Tester"
            ),
            SecurityRepositorySource(
                id="SRC-APP-002", name="OWASP WebGoat",
                url="https://github.com/WebGoat/WebGoat.git",
                category="BENCHMARK_APP",
                description="Java/Spring Boot 기반 웹 취약점 교육 및 벤치마크 앱",
                target_engine="Java Spring Vulnerability Suite"
            ),
            SecurityRepositorySource(
                id="SRC-APP-003", name="OWASP Benchmark Java Test Suite",
                url="https://github.com/OWASP-Benchmark/BenchmarkJava.git",
                category="BENCHMARK_APP",
                description="SAST/DAST 정밀도 및 오탐률(FP) 측정을 위한 2,740개 표준 테스트 케이스",
                target_engine="False Positive Calibration Suite"
            ),
            SecurityRepositorySource(
                id="SRC-APP-004", name="Damn Vulnerable Web Application (DVWA)",
                url="https://github.com/digininja/DVWA.git",
                category="BENCHMARK_APP",
                description="PHP/MySQL 기반 고전 웹 취약점 테스트 벤치마크",
                target_engine="PHP/SQLi Benchmark Suite"
            ),
            SecurityRepositorySource(
                id="SRC-APP-005", name="OWASP Mutillidae II",
                url="https://github.com/webpwnized/mutillidae.git",
                category="BENCHMARK_APP",
                description="다양한 웹 공격 시나리오와 비즈니스 로직 테스트 샌드박스",
                target_engine="Web Logic Benchmark Suite"
            ),
            SecurityRepositorySource(
                id="SRC-APP-006", name="Android InsecureBank v2",
                url="https://github.com/dineshshetty/Android-InsecureBankv2.git",
                category="BENCHMARK_APP",
                description="안드로이드 모바일 앱 취약점 검증용 뱅킹 애플리케이션",
                target_engine="Android APK Scanner Suite"
            ),
            SecurityRepositorySource(
                id="SRC-APP-007", name="RhinoCloud CloudGoat",
                url="https://github.com/RhinoSecurityLabs/cloudgoat.git",
                category="BENCHMARK_APP",
                description="AWS 클라우드 인프라 및 IAM 권한 상승 취약점 샌드박스",
                target_engine="Cloud Security Auditor"
            ),
            SecurityRepositorySource(
                id="SRC-APP-008", name="Kubernetes Goat",
                url="https://github.com/madhuakula/kubernetes-goat.git",
                category="BENCHMARK_APP",
                description="쿠버네티스 컨테이너 클러스터 보안 및 설정 오류 벤치마크",
                target_engine="K8s Container Auditor"
            ),
            SecurityRepositorySource(
                id="SRC-APP-009", name="Android Security Samples",
                url="https://github.com/android/security-samples.git",
                category="BENCHMARK_APP",
                description="구글 안드로이드 팀의 보안 모범 사례 및 안심 코딩 샘플",
                target_engine="Android Secure Code Reference"
            ),

            # --- 4. Rulesets, Scanner Engines & Payload Dictionaries ---
            SecurityRepositorySource(
                id="SRC-RUL-001", name="Semgrep Rules Core Library",
                url="https://github.com/semgrep/semgrep-rules.git",
                category="RULE_ENGINE",
                description="AST 시맨틱 코드 분석용 표준 2,000+ 규칙 세트",
                target_engine="SAST Rule Engine"
            ),
            SecurityRepositorySource(
                id="SRC-RUL-002", name="OWASP ModSecurity Core Rule Set (CRS)",
                url="https://github.com/coreruleset/coreruleset.git",
                category="RULE_ENGINE",
                description="웹 애플리케이션 방화벽(WAF) 시그니처 및 웹 룰셋",
                target_engine="WAF & DAST Rule Sync"
            ),
            SecurityRepositorySource(
                id="SRC-RUL-003", name="ProjectDiscovery Nuclei Templates",
                url="https://github.com/projectdiscovery/nuclei-templates.git",
                category="RULE_ENGINE",
                description="커뮤니티 검증 4,000+ 취약점 DAST 검증 YAML 템플릿",
                target_engine="DAST Evidence Replay Engine"
            ),
            SecurityRepositorySource(
                id="SRC-RUL-004", name="OWASP ZAP Engine Rules",
                url="https://github.com/zaproxy/zaproxy.git",
                category="RULE_ENGINE",
                description="OWASP ZAP 파커스 캔 및 액티브/패시브 스캐닝 엔진",
                target_engine="Dynamic Web Scanner"
            ),
            SecurityRepositorySource(
                id="SRC-RUL-005", name="Mobile Security Framework (MobSF)",
                url="https://github.com/MobSF/Mobile-Security-Framework-MobSF.git",
                category="RULE_ENGINE",
                description="Android APK / iOS IPA 정적 디컴파일 및 동적 보안 분석 엔진",
                target_engine="Mobile Security Pipeline"
            ),
            SecurityRepositorySource(
                id="SRC-RUL-006", name="SecLists Payload Dictionary",
                url="https://github.com/danielmiessler/SecLists.git",
                category="FUZZ_PAYLOAD",
                description="보안 감사용 패스워드, 파라미터, 셋업 페이로드 종합 딕셔너리",
                target_engine="Synthetic Fuzzing Payload Generator"
            ),
            SecurityRepositorySource(
                id="SRC-RUL-007", name="FuzzDB Attack Payloads",
                url="https://github.com/fuzzdb-project/fuzzdb.git",
                category="FUZZ_PAYLOAD",
                description="비정상 데이터 주입 및 인풋 검증 테스트 페이로드 라이브러리",
                target_engine="API Input Validation Fuzzer"
            )
        ]

    def get_sources_by_category(self, category: str) -> List[SecurityRepositorySource]:
        return [r for r in self.repo_registry if r.category == category]

    def generate_pipeline_summary(self) -> Dict[str, Any]:
        categories = {}
        for r in self.repo_registry:
            categories[r.category] = categories.get(r.category, 0) + 1
        
        return {
            "total_repositories": len(self.repo_registry),
            "unique_repos_count": len(set(r.url for r in self.repo_registry)),
            "category_distribution": categories,
            "pipeline_status": "Ready for Sync"
        }

if __name__ == "__main__":
    manager = DatasetIngestionManager()
    summary = manager.generate_pipeline_summary()
    print(f"📦 [AegisAI Source Manager] Registered {summary['total_repositories']} authoritative security repos.")
    print("   Category Breakdown:", json.dumps(summary["category_distribution"], indent=2))
