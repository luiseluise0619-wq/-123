/* ==========================================================================
   AEGIS.AI - Expanded Vulnerability Categories & SaaS Workflow Data Store
   ========================================================================== */

const SECURITY_KNOWLEDGE_BASE = {
    // 💡 1. Expanded Detection Categories (SSRF, Deserialization, OAuth, IAM, K8s, Secrets)
    expanded_detection_domains: [
        { domain: "Web & API Security", categories: ["SQL Injection (CWE-89)", "XSS (CWE-79)", "SSRF (CWE-918)", "Insecure Deserialization (CWE-502)", "OAuth 2.0 State Flaws (CWE-601)"] },
        { domain: "Business Logic", categories: ["Ticket Refund Fee Tampering (CWE-840)", "Zero-Price Checkout (CWE-20)", "Coupon Race Condition (CWE-362)", "IDOR (CWE-639)", "JWT alg: none (CWE-287)"] },
        { domain: "Cloud & DevSecOps", categories: ["AWS/GCP IAM Action:* Wildcard (CWE-732)", "Kubernetes Privileged Container (CWE-250)", "Secrets Exposure (CWE-798)"] },
        { domain: "Mobile Security", categories: ["Android MODE_WORLD_READABLE (CWE-922)", "iOS ATS Cleartext HTTP (CWE-319)"] }
    ],

    // 💡 2. End-to-End DevSecOps Workflow Definition
    devsecops_mvp_workflow: [
        { step: 1, name: "GitHub App OAuth Connect", status: "Active", desc: "1-Click OAuth connection with repo & pull_requests:write scopes." },
        { step: 2, name: "Git Push / PR Webhook Trigger", status: "Active", desc: "Automatic scan execution on developer push / PR creation." },
        { step: 3, name: "AI RedTeam & Docker Sandbox Scan", status: "Active", desc: "CodeBERT static analysis + isolated Docker sandbox attack replay." },
        { step: 4, name: "Cryptographic Evidence Generation", status: "Active", desc: "SHA-256 signed HTTP request/response packet captures & cURL box." },
        { step: 5, name: "Automated Fix PR Branch Creation", status: "Active", desc: "Pushes security/fix-xxx branch & opens GitHub Pull Request." },
        { step: 6, name: "Developer Review & Merge", status: "Active", desc: "Developer verifies cURL proof & merges PR (CI Checks Passed)." }
    ],

    // 💡 3. Enterprise RBAC Roles Specification
    enterprise_rbac_roles: [
        { role: "Admin", permissions: "Full Organization Control, Member Invites, Stripe Billing, API Token Issuance, Complete Audit Trail Access", user_count: 2 },
        { role: "Security Lead", permissions: "Trigger Audits, PR Gate Policy Enforcement, Findings Review, Audit Log View, API Access", user_count: 5 },
        { role: "Developer", permissions: "Trigger Repository Scans, View Assigned Findings & cURL Evidence, Accept/Merge Fix PRs", user_count: 24 }
    ],

    // 💡 4. Audit Trail Logs Sample Register
    audit_trail_logs: [
        { audit_id: "AUD-1754201829001", timestamp: "2026-08-03T17:05:00Z", user_email: "sec_lead@security.io", user_role: "Security Lead", action: "TRIGGER_SECURITY_AUDIT", repository: "organization/ticket-backend", details: "Scan JOB-1754201829 completed. Secrets masked." },
        { audit_id: "AUD-1754201829002", timestamp: "2026-08-03T16:58:20Z", user_email: "dev_lead@security.io", user_role: "Developer", action: "ACCEPT_FIX_PR", repository: "organization/ticket-backend", details: "Merged PR #8821 (Negative Refund Fee Fix)." },
        { audit_id: "AUD-1754201829003", timestamp: "2026-08-03T16:50:00Z", user_email: "admin@security.io", user_role: "Admin", action: "UPDATE_SECURITY_POLICY", repository: "GLOBAL_ORG", details: "Enforced Mandatory PR Blocking Gate for Critical Vulns." }
    ],

    // 💡 5. False Positive & Verification Audit Ledger
    fp_verification_ledger: {
        total_hits_captured: 130,
        sandbox_verified: 30,
        true_positives: 120,
        false_positives: 5,
        pending_review: 5,
        true_positive_rate: "92.3%",
        false_positive_rate: "3.8%"
    },

    // 💡 6. Public Benchmark Showcase Repositories
    public_showcase_repos: [
        {
            id: "AEGIS-2026-0001",
            name: "OWASP Juice Shop",
            repo_url: "https://github.com/juice-shop/juice-shop",
            commit_hash: "a1f94c2089b212c778e123901b223019",
            category: "Web App",
            framework: "Node.js / Angular",
            language: "TypeScript",
            finding_title: "SQL Injection in User Search API (CWE-89)",
            evidence_summary: "GET /rest/products/search?q=' OR 1=1-- 200 OK captured with entire product database dump.",
            fix_pr_url: "https://github.com/juice-shop/juice-shop/pull/4891",
            ci_status: "PASSED (CI Checks Passed)"
        },
        {
            id: "AEGIS-2026-0002",
            name: "Ticket Backend Demo",
            repo_url: "https://github.com/organization/ticket-backend",
            commit_hash: "c7f91a29001b223458fa991209b772a0",
            category: "Web App",
            framework: "FastAPI",
            language: "Python",
            finding_title: "Ticketing Refund Fee Negative Tampering (CWE-840)",
            evidence_summary: "POST /api/v1/tickets/cancel payload: {refund_fee: -150000} ➔ ₩300,000 double refund approved.",
            fix_pr_url: "https://github.com/organization/ticket-backend/pull/8821",
            ci_status: "PASSED (CI Checks Passed)"
        },
        {
            id: "AEGIS-2026-0006",
            name: "Cloud Infrastructure IaC",
            repo_url: "https://github.com/organization/cloud-infrastructure-iac",
            commit_hash: "d91024bc01b22301984b2c129e612809",
            category: "Cloud IAM / K8s",
            framework: "Terraform / AWS IAM",
            language: "HCL / JSON",
            finding_title: "AWS IAM Policy Wildcard Admin Action: * (CWE-732)",
            evidence_summary: "IAM Policy allows Effect: Allow, Action: *, Resource: * for application execution role.",
            fix_pr_url: "https://github.com/organization/cloud-infrastructure-iac/pull/104",
            ci_status: "PASSED (CI Checks Passed)"
        }
    ],

    continuous_security_config: {
        git_push_webhook_active: true,
        pr_blocking_gate: "ENABLED (Critical Vuln = PR Blocked)",
        slack_alerts_channel: "#sec-alerts-devsecops",
        ci_status_check_name: "AegisAI / Security Gate",
        last_blocked_pr: {
            pr_id: "PR-8821",
            repo: "organization/ticket-backend",
            author: "developer_a",
            branch: "feature/refund-logic",
            reason: "BLOCKED: 1 Critical Vulnerability (AEGIS-2026-0002)",
            timestamp: "2026-08-03T17:05:00.000Z"
        }
    },

    core_positioning: {
        headline: "배포 전에 개발자가 자기 서비스의 보안 문제를 자동으로 찾고 바로 수정 PR까지 받는 DevSecOps 자동화 플랫폼",
        subtext: "Git Push / PR 생성 시 자동 진단하여 위험 시 PR을 블록(Block)하고 오탐률 3.8% 수준의 시정 PR을 자동 발행합니다."
    },

    realworld_metrics: {
        total_tested_new_apps: 120,
        critical_detection_rate: "89.3%",
        false_positive_rate: "3.8%",
        false_negative_rate: "1.9%",
        avg_time_to_fix_pr: "1.4분",
        verification_method: "Temporal Split Validation (Train: pre-2025 CVEs | Test: 2025-2026 50 Unseen Repositories)"
    },

    vulnerabilities: [
        {
            id: "AEGIS-2026-0002",
            vulnerability_id: "AEGIS-2026-0002",
            title: "티켓 예매 취소 및 환불 요청 시 환불 수수료 음수 조작 (Ticketing Refund Fee Tampering)",
            type: "Business Logic",
            category: "비즈니스 로직 취약점",
            severity: "Critical",
            cve: "CWE-840 / CWE-20",
            location: "POST /api/v1/tickets/cancel & /refund/process",
            sandbox_executed: true,
            evidence_status: "Verified (Sandbox Replay 3/3 Proof)",
            sandbox_notice: "🔒 티켓 예매 도메인 인지 ➔ docker-compose 샌드박스(http://127.0.0.1:18090)에서 환불 테스트 안전 수행됨",
            
            validation_pipeline: {
                hypothesis: "취소 요청 시 클라이언트가 보낸 refund_fee 수수료 파라미터가 음수일 경우 감산 연산(original_price - refund_fee)에 의해 환불금이 원금보다 커질 것이다.",
                generated_testcase: "POST /api/v1/tickets/cancel payload: {ticket_id: 'TKT-VIP-1029', original_price: 150000, refund_fee: -150000}",
                sandbox_execution_result: "HTTP 200 OK Received. total_refund_amount: 300,000 (Expected 135,000)",
                verdict: "HYPOTHESIS_PROVEN_TRUE"
            },

            automated_pr: {
                pr_id: "PR-8821",
                pr_url: "https://github.com/organization/ticket-backend/pull/8821",
                pr_title: "[SECURITY GATE BLOCKED] Negative Refund Fee Tampering (AEGIS-2026-0002) Detected",
                branch_name: "feature/refund-logic",
                ci_status: "BLOCKED & Slack Alert Dispatched (#sec-alerts-devsecops)"
            },

            evidence_metadata: {
                evidence_id: "EV-20260803-99182",
                timestamp_utc: "2026-08-03T17:05:00.000Z",
                scan_job_id: "JOB-AEGIS-2026-0803-994",
                sandbox_container_id: "cnt-sandbox-sbx-ticket-99812",
                sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                replay_count: 3,
                replay_success_rate: "3/3 (100% Reproducible)",
                agent_signature: "AegisAI-Agent-v2.4-HMAC-SHA256"
            },

            confidence_scoring: {
                total_score: 98,
                confidence_level: "High Confidence (Replay Verified)",
                breakdown: {
                    evidence_proof: { score: 40, max: 40, label: "Evidence Proof (HTTP Packet Capture)", status: "Verified" },
                    exploitability: { score: 30, max: 30, label: "Exploitability (Replay #3 Success)", status: "Proven" },
                    impact_risk: { score: 19, max: 20, label: "Financial & Business Impact", status: "Critical Risk" },
                    ai_reasoning: { score: 9, max: 10, label: "AI Logic State Consistency", status: "Validated" }
                }
            },

            evidence: {
                request: `POST /api/v1/tickets/cancel HTTP/1.1
Host: 127.0.0.1:18090 (Cloned Container)
Content-Type: application/json

{
  "ticket_id": "TKT-VIP-1029",
  "original_price": 150000,
  "refund_fee": -150000
}`,
                response: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "REFUND_APPROVED",
  "total_refund_amount": 300000
}`,
                proof_summary: "티켓 예매 취소 과정에서 수수료 음수 조작으로 원금 2배 환불 승인 200 OK 응답 캡처."
            },

            curl_replay: `curl -X POST 'http://127.0.0.1:18090/api/v1/tickets/cancel' -H 'Content-Type: application/json' -d '{"ticket_id": "TKT-VIP-1029", "original_price": 150000, "refund_fee": -150000}'`,

            attack_scenario: [
                "1. buyer_a@security.local VIP 좌석 150,000원 예매.",
                "2. 취소 API에서 refund_fee: -150,000원 주입.",
                "3. 원금 + 150,000원 = 총 300,000원 환불 승인 수신."
            ],
            impact: "환불 시스템 파괴 및 서비스 자금 유출",
            vulnerable_code: `@app.post("/api/v1/tickets/cancel")
async def cancel_ticket(payload: CancelTicketRequest):
    refund_total = payload.original_price - payload.refund_fee
    return {"status": "REFUND_APPROVED", "total_refund_amount": refund_total}`,
            fixed_code: `@app.post("/api/v1/tickets/cancel")
async def cancel_ticket(payload: CancelTicketRequest, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == payload.ticket_id).first()
    policy_fee = calculate_policy_refund_fee(ticket)
    real_refund = ticket.original_price - policy_fee
    return {"status": "REFUND_APPROVED", "total_refund_amount": real_refund}`,
            remediation_reason: "수수료는 항상 서버 정책 함수로 재계산해야 합니다."
        }
    ],

    attack_simulations: [
        { step: 1, phase: "Continuous Security Trigger", action: "Git Push & PR #8821 이벤트 수신 ➔ Continuous Security Engine 자동 트리거", status: "Success", detail: "GitHub Webhook Event Accepted" },
        { step: 2, phase: "Vulnerability Taxonomy Assignment", action: "고유 취약점 식별자 AEGIS-2026-0002 (CWE-840, Business Logic, Critical) 할당", status: "Taxonomy Assigned", detail: "Severity & CWE Mapped" },
        { step: 3, phase: "Docker Sandbox Evidence", action: "티켓 예매 수수료 음수 조작 (-150,000원) 200 OK 캡처 및 SHA-256 서명", status: "Critical Hit", detail: "SHA-256 증거 서명 획득 (Verified)" },
        { step: 4, phase: "PR Blocking & Slack Notification", action: "Critical 취약점 발견으로 GitHub PR #8821 Status FAILURE (Blocked) 설정 및 Slack #sec-alerts 알림 전송", status: "PR Blocked & Alerted", detail: "Security Gate Enforced & Fix PR Issued" }
    ],

    demo_projects: [
        { id: "proj-1", name: "ticket-backend Repo (Continuous Security)", target_type: "github", target: "https://github.com/organization/ticket-backend", score: 64, status: "Warning", vuln_summary: { critical: 2, high: 2, medium: 3, low: 1 }, last_audit: "2026-08-03 17:05" }
    ]
};
