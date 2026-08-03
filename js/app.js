/* ==========================================================================
   AEGIS.AI - Render Enterprise RBAC, Audit Logs, & REST API Panels
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initScanForm();
    initDashboard();
    initReportScreen();
    initLiveClock();
});

function initLiveClock() {
    const clockEl = document.getElementById("live-time");
    if (!clockEl) return;
    setInterval(() => {
        const now = new Date();
        clockEl.textContent = now.toISOString().replace("T", " ").substring(0, 19);
    }, 1000);
}

function initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabPanes = document.querySelectorAll(".tab-pane");

    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute("data-tab");

            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");

            tabPanes.forEach(pane => {
                pane.classList.remove("active");
                if (pane.id === `tab-${targetTab}`) {
                    pane.classList.add("active");
                }
            });

            if (targetTab === "dashboard") renderDashboardView();
            if (targetTab === "projects") renderProjectsView();
            if (targetTab === "reports") renderReportView();
        });
    });

    document.getElementById("btn-header-scan")?.addEventListener("click", () => switchTab("new-scan"));
    document.getElementById("btn-quick-demo")?.addEventListener("click", () => {
        switchTab("new-scan");
        document.getElementById("target-url").value = "https://shop-demo.aegis-security.io";
        startAiAuditSimulation();
    });
}

function switchTab(tabName) {
    const targetNav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
    if (targetNav) targetNav.click();
}

function initScanForm() {
    const typeBtns = document.querySelectorAll(".scan-type-btn");
    const inputGroups = document.querySelectorAll(".scan-input-group");

    typeBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const type = btn.getAttribute("data-type");

            typeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            inputGroups.forEach(group => group.classList.add("hidden"));
            const activeGroup = document.getElementById(`group-${type}`);
            if (activeGroup) activeGroup.classList.remove("hidden");
        });
    });

    const scanForm = document.getElementById("scan-form");
    if (scanForm) {
        scanForm.addEventListener("submit", (e) => {
            e.preventDefault();
            startAiAuditSimulation();
        });
    }
}

function startAiAuditSimulation() {
    const progressPanel = document.getElementById("scan-progress-panel");
    const formCard = document.querySelector(".scan-config-card");
    const terminalOutput = document.getElementById("terminal-log-output");
    const progressBar = document.getElementById("scan-progress-bar");
    const percentText = document.getElementById("scan-percent-text");

    if (!progressPanel || !terminalOutput) return;

    formCard.classList.add("hidden");
    progressPanel.classList.remove("hidden");
    terminalOutput.innerHTML = "";

    const targetUrl = document.getElementById("target-url")?.value || "https://shop-demo.aegis-security.io";
    document.getElementById("progress-target-name").textContent = targetUrl;

    const logMessages = [
        { time: "16:12:01", tag: "RBAC", msg: `Enterprise Role Checked: X-User-Role: Security Lead (X-Org-Id: ORG-SEC-ENTERPRISE)` },
        { time: "16:12:03", tag: "SECRETS", msg: "Secrets Masking Engine Active: Masking AWS/GitHub PAT/Bearer Tokens in log stream..." },
        { time: "16:12:06", tag: "AUDIT-LOG", msg: "Writing Compliance Audit Trail: AUD-1754201829 (Who: sec_lead@security.io | Repo: ticket-backend)" },
        { time: "16:12:09", tag: "API", msg: "REST API Endpoint POST /api/v1/audit Executed (200 OK)" },
        { time: "16:12:12", tag: "HARDENING", msg: "Transient Docker Sandbox Code Wiped (shutil.rmtree + docker rm -f completed)" },
        { time: "16:12:15", tag: "REPORT", msg: "Enterprise Audit Pipeline Complete. Audit Trail & Fix PR Ready." }
    ];

    let step = 0;
    const interval = setInterval(() => {
        if (step < logMessages.length) {
            const item = logMessages[step];
            const logLine = document.createElement("div");
            logLine.className = "log-line";
            logLine.innerHTML = `
                <span class="log-time">[${item.time}]</span>
                <span class="log-tag ${item.tag.toLowerCase()}">${item.tag}</span>
                <span class="log-msg">${item.msg}</span>
            `;
            terminalOutput.appendChild(logLine);
            terminalOutput.scrollTop = terminalOutput.scrollHeight;

            const percent = Math.min(100, Math.round(((step + 1) / logMessages.length) * 100));
            progressBar.style.width = `${percent}%`;
            percentText.textContent = `${percent}%`;

            const activePhaseNum = Math.min(6, Math.floor((step / logMessages.length) * 6) + 1);
            for (let i = 1; i <= 6; i++) {
                const phaseEl = document.getElementById(`phase-step-${i}`);
                if (phaseEl) {
                    if (i < activePhaseNum) phaseEl.className = "phase-step completed";
                    else if (i === activePhaseNum) phaseEl.className = "phase-step active";
                }
            }

            step++;
        } else {
            clearInterval(interval);
            setTimeout(() => {
                formCard.classList.remove("hidden");
                progressPanel.classList.add("hidden");
                switchTab("reports");
            }, 1000);
        }
    }, 700);
}

function initDashboard() { renderDashboardView(); }

function renderDashboardView() {
    const recentList = document.getElementById("dashboard-recent-list");
    if (!recentList) return;

    recentList.innerHTML = SECURITY_KNOWLEDGE_BASE.demo_projects.map(proj => `
        <div class="audit-item glass-panel" style="padding: 14px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h4 style="font-size: 14px; margin-bottom: 2px;">${proj.name}</h4>
                <span style="font-size: 11px; color: var(--text-muted);">${proj.target}</span>
            </div>
            <div style="text-align: right;">
                <span style="font-weight: 800; font-size: 16px;" class="${proj.score < 75 ? 'text-gold' : 'text-green'}">${proj.score}점</span>
                <span style="display: block; font-size: 10px; color: var(--text-muted);">${proj.last_audit}</span>
            </div>
        </div>
    `).join("");
}

function renderProjectsView() {
    const projectsList = document.getElementById("projects-card-list");
    if (!projectsList) return;

    projectsList.innerHTML = SECURITY_KNOWLEDGE_BASE.demo_projects.map(proj => `
        <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                <div>
                    <span class="badge badge-accent" style="margin-bottom: 6px; display: inline-block;">${proj.target_type.toUpperCase()}</span>
                    <h3 style="font-size: 18px;">${proj.name}</h3>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${proj.target}</p>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 28px; font-weight: 800;" class="${proj.score < 75 ? 'text-gold' : 'text-green'}">${proj.score}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">/ 100</span>
                </div>
            </div>
            <div style="display: flex; gap: 12px; font-size: 12px; border-top: 1px solid var(--border-glass); padding-top: 14px;">
                <span class="text-red">Critical: ${proj.vuln_summary.critical}</span>
                <span class="text-gold">High: ${proj.vuln_summary.high}</span>
                <span class="text-cyan">Medium: ${proj.vuln_summary.medium}</span>
                <span class="text-muted" style="margin-left: auto;">마지막 검사: ${proj.last_audit}</span>
            </div>
        </div>
    `).join("");
}

function initReportScreen() {
    renderReportView();
    document.getElementById("btn-re-scan")?.addEventListener("click", () => switchTab("new-scan"));
}

function renderReportView() {
    renderPositioningBanner();
    renderEnterpriseRbacPanel();
    renderAuditLogsPanel();
    renderFpVerificationLedgerPanel();
    renderPublicShowcasePanel();
    renderContinuousSecurityPanel();
    render15AppsBenchmarkTable();
    renderAccuracyMetricsPanel();
    renderAttackChainVisualizer();
    renderVulnerabilityAccordion();
}

function renderPositioningBanner() {
    const reportTitleBox = document.querySelector("#tab-reports .page-title-box");
    if (!reportTitleBox) return;

    let banner = document.getElementById("positioning-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "positioning-banner";
        banner.className = "glass-panel";
        banner.style.cssText = "padding: 16px 24px; margin-bottom: 20px; border: 1px solid rgba(0, 242, 254, 0.4); background: linear-gradient(135deg, rgba(0, 242, 254, 0.08), rgba(157, 78, 223, 0.08));";
        reportTitleBox.parentNode.insertBefore(banner, reportTitleBox.nextSibling);
    }

    const pos = SECURITY_KNOWLEDGE_BASE.core_positioning;
    banner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
                <span class="badge badge-accent" style="background: rgba(0, 242, 254, 0.15); color: var(--accent-cyan); margin-bottom: 6px; display: inline-block;">
                    <i class="fa-solid fa-building-user"></i> Enterprise Security Auditor Platform
                </span>
                <h3 style="font-size: 16px; color: var(--text-primary); margin-bottom: 4px;">"${pos.headline}"</h3>
                <p style="font-size: 12px; color: var(--text-secondary);">${pos.subtext}</p>
            </div>
            <div style="text-align: right;">
                <span class="badge badge-accent" style="background: rgba(0, 230, 118, 0.2); color: var(--accent-green); border-color: rgba(0, 230, 118, 0.4);">
                    <i class="fa-solid fa-user-shield"></i> Enterprise RBAC & Audit Trail Active
                </span>
            </div>
        </div>
    `;
}

// 💡 Render Enterprise RBAC Roles Panel
function renderEnterpriseRbacPanel() {
    const reportTitleBox = document.querySelector("#tab-reports .page-title-box");
    if (!reportTitleBox) return;

    let rbacBox = document.getElementById("enterprise-rbac-panel");
    if (!rbacBox) {
        rbacBox = document.createElement("div");
        rbacBox.id = "enterprise-rbac-panel";
        rbacBox.className = "glass-panel";
        rbacBox.style.cssText = "padding: 18px 24px; margin-bottom: 20px; border: 1px solid rgba(157, 78, 223, 0.4); background: rgba(157, 78, 223, 0.04);";
        reportTitleBox.parentNode.insertBefore(rbacBox, reportTitleBox.nextSibling.nextSibling);
    }

    const roles = SECURITY_KNOWLEDGE_BASE.enterprise_rbac_roles;
    rbacBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 15px; color: var(--accent-purple); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-users-gear"></i> Organization RBAC Roles & Permissions Matrix
            </h4>
            <span class="badge badge-accent" style="background: rgba(157, 78, 223, 0.2); color: var(--accent-purple);">
                Multi-tenancy Active
            </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
            ${roles.map(r => `
                <div style="padding: 12px; background: rgba(0,0,0,0.3); border-radius: 6px; border: 1px solid var(--border-glass);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-primary);">${r.role}</span>
                        <span class="badge badge-accent" style="font-size: 10px;">${r.user_count} Users</span>
                    </div>
                    <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">${r.permissions}</p>
                </div>
            `).join("")}
        </div>
    `;
}

// 💡 Render Audit Trail Logs Panel
function renderAuditLogsPanel() {
    const reportTitleBox = document.querySelector("#tab-reports .page-title-box");
    if (!reportTitleBox) return;

    let logBox = document.getElementById("audit-logs-panel");
    if (!logBox) {
        logBox = document.createElement("div");
        logBox.id = "audit-logs-panel";
        logBox.className = "glass-panel";
        logBox.style.cssText = "padding: 18px 24px; margin-bottom: 20px; border: 1px solid rgba(0, 242, 254, 0.3); background: rgba(0, 242, 254, 0.03);";
        reportTitleBox.parentNode.insertBefore(logBox, reportTitleBox.nextSibling.nextSibling.nextSibling);
    }

    const logs = SECURITY_KNOWLEDGE_BASE.audit_trail_logs;
    logBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 15px; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-list-check"></i> Compliance Audit Logs (Who, When, Repo, Action)
            </h4>
            <span class="badge badge-accent" style="background: rgba(0, 242, 254, 0.15); color: var(--accent-cyan); font-size: 11px;">
                <i class="fa-solid fa-lock"></i> Immutable Ledger
            </span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 160px; overflow-y: auto;">
            ${logs.map(l => `
                <div style="padding: 8px 12px; background: rgba(0,0,0,0.4); border-radius: 6px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-family: var(--font-mono); color: var(--accent-cyan); margin-right: 8px;">[${l.timestamp}]</span>
                        <strong style="color: var(--text-primary); margin-right: 6px;">${l.user_email} (${l.user_role}):</strong>
                        <span style="color: var(--accent-gold); margin-right: 8px;">${l.action}</span>
                        <span style="color: var(--text-muted); font-family: var(--font-mono);">${l.repository}</span>
                    </div>
                    <span style="font-size: 10px; color: var(--text-muted);">${l.details}</span>
                </div>
            `).join("")}
        </div>
    `;
}

function renderFpVerificationLedgerPanel() {
    const reportTitleBox = document.querySelector("#tab-reports .page-title-box");
    if (!reportTitleBox) return;

    let fpBox = document.getElementById("fp-verification-ledger-panel");
    if (!fpBox) {
        fpBox = document.createElement("div");
        fpBox.id = "fp-verification-ledger-panel";
        fpBox.className = "glass-panel";
        fpBox.style.cssText = "padding: 18px 24px; margin-bottom: 20px; border: 1px solid rgba(0, 230, 118, 0.3); background: rgba(0, 230, 118, 0.03);";
        reportTitleBox.parentNode.insertBefore(fpBox, reportTitleBox.nextSibling.nextSibling.nextSibling.nextSibling);
    }

    const fp = SECURITY_KNOWLEDGE_BASE.fp_verification_ledger;
    fpBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 15px; color: var(--accent-green); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-square-check"></i> False Positive Audit & Verification Ledger (신뢰도 검증 현황)
            </h4>
            <span class="badge badge-accent" style="background: rgba(0, 230, 118, 0.2); color: var(--accent-green);">
                True Positive Rate: ${fp.true_positive_rate}
            </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center;">
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">총 발견 (Captured)</span>
                <span style="font-size: 18px; font-weight: 800; color: var(--text-primary);">${fp.total_hits_captured}</span>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">샌드박스 검증 완료</span>
                <span style="font-size: 18px; font-weight: 800; color: var(--accent-cyan);">${fp.sandbox_verified}</span>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">진짜 취약점 (True Positives)</span>
                <span style="font-size: 18px; font-weight: 800; color: var(--accent-green);">${fp.true_positives}</span>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">오탐 (False Positives)</span>
                <span style="font-size: 18px; font-weight: 800; color: var(--accent-red);">${fp.false_positives} (${fp.false_positive_rate})</span>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">리뷰 진행 중 (Pending)</span>
                <span style="font-size: 18px; font-weight: 800; color: var(--accent-gold);">${fp.pending_review}</span>
            </div>
        </div>
    `;
}

function renderPublicShowcasePanel() {
    const reportTitleBox = document.querySelector("#tab-reports .page-title-box");
    if (!reportTitleBox) return;

    let showcaseBox = document.getElementById("public-showcase-repos-box");
    if (!showcaseBox) {
        showcaseBox = document.createElement("div");
        showcaseBox.id = "public-showcase-repos-box";
        showcaseBox.className = "glass-panel";
        showcaseBox.style.cssText = "padding: 20px 24px; margin-bottom: 20px; border: 1px solid rgba(0, 242, 254, 0.3); background: rgba(0, 242, 254, 0.03);";
        reportTitleBox.parentNode.insertBefore(showcaseBox, reportTitleBox.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling);
    }

    const repos = SECURITY_KNOWLEDGE_BASE.public_showcase_repos;
    showcaseBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 15px; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-square-poll-vertical"></i> Public Benchmark Showcase (Vulnerability ID ➔ Evidence ➔ Auto Fix PR)
            </h4>
            <span class="badge badge-accent" style="background: rgba(0,242,254,0.15); color: var(--accent-cyan); font-size: 11px;">
                <i class="fa-solid fa-hashtag"></i> ID Taxonomy Assigned
            </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(1, 1fr); gap: 10px; max-height: 200px; overflow-y: auto;">
            ${repos.map(r => `
                <div style="padding: 10px 14px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-glass); border-radius: 6px; font-size: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; color: var(--text-primary);">
                            <span class="badge badge-accent" style="font-size: 10px; margin-right: 6px; background: rgba(0,242,254,0.15); color: var(--accent-cyan);">${r.id}</span>
                            <a href="${r.repo_url}" target="_blank" style="color: var(--text-primary); text-decoration: none;">${r.name}</a>
                            <span style="font-size: 11px; font-weight: 400; color: var(--text-muted);">(${r.category} | Commit: <code class="text-cyan">${r.commit_hash.substring(0, 8)}</code>)</span>
                        </span>
                        <a href="${r.fix_pr_url}" target="_blank" class="badge badge-accent" style="background: rgba(157, 78, 223, 0.2); color: var(--accent-purple); border-color: rgba(157, 78, 223, 0.4); text-decoration: none;">
                            <i class="fa-brands fa-github"></i> ${r.ci_status}
                        </a>
                    </div>
                    <div style="color: var(--accent-red); font-weight: 600; font-size: 11px;">🔍 ${r.finding_title}</div>
                    <div style="color: var(--text-secondary); font-size: 11px; margin-top: 2px;">⚡ Evidence: <span class="font-mono text-muted">${r.evidence_summary}</span></div>
                </div>
            `).join("")}
        </div>
    `;
}

function renderContinuousSecurityPanel() {
    const reportTitleBox = document.querySelector("#tab-reports .page-title-box");
    if (!reportTitleBox) return;

    let csPanel = document.getElementById("continuous-security-panel");
    if (!csPanel) {
        csPanel = document.createElement("div");
        csPanel.id = "continuous-security-panel";
        csPanel.className = "glass-panel";
        csPanel.style.cssText = "padding: 20px 24px; margin-bottom: 20px; border: 1px solid rgba(255, 59, 92, 0.4); background: rgba(255, 59, 92, 0.04);";
        reportTitleBox.parentNode.insertBefore(csPanel, reportTitleBox.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling);
    }

    const cs = SECURITY_KNOWLEDGE_BASE.continuous_security_config;
    csPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 15px; color: var(--accent-red); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-code-pull-request"></i> Continuous Security: PR Gating & Slack Alert System
            </h4>
            <span class="badge badge-accent" style="background: rgba(255, 59, 92, 0.2); color: var(--accent-red); border-color: rgba(255, 59, 92, 0.4);">
                <i class="fa-solid fa-ban"></i> Gate Action: PR Blocked
            </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px;">
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">Trigger Event</span>
                <span style="font-size: 13px; font-weight: 700; color: var(--accent-cyan);">Git Push / Pull Request Webhook</span>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">PR Gating Rule</span>
                <span style="font-size: 13px; font-weight: 700; color: var(--accent-red);">${cs.pr_blocking_gate}</span>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">Notification Channel</span>
                <span style="font-size: 13px; font-weight: 700; color: var(--accent-green);"><i class="fa-brands fa-slack"></i> ${cs.slack_alerts_channel}</span>
            </div>
        </div>
    `;
}

function render15AppsBenchmarkTable() {
    const reportTitleBox = document.querySelector("#tab-reports .page-title-box");
    if (!reportTitleBox) return;

    let tableBox = document.getElementById("benchmark-15-apps-table-box");
    if (!tableBox) {
        tableBox = document.createElement("div");
        tableBox.id = "benchmark-15-apps-table-box";
        tableBox.className = "glass-panel";
        tableBox.style.cssText = "padding: 20px 24px; margin-bottom: 24px;";
        reportTitleBox.parentNode.insertBefore(tableBox, reportTitleBox.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling);
    }

    const matrix = SECURITY_KNOWLEDGE_BASE.open_benchmark_matrix;
    tableBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div>
                <h4 style="font-size: 15px; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-table-list"></i> 15 Open Vulnerable Apps Benchmark Matrix (10 Web + 5 Mobile)
                </h4>
                <span style="font-size: 11px; color: var(--text-muted);">${matrix.evaluation_methodology}</span>
            </div>
            <div style="display: flex; gap: 10px;">
                <span class="badge badge-accent" style="background: rgba(0,230,118,0.15); color: var(--accent-green);">탐지율: ${matrix.overall_detection_rate}</span>
                <span class="badge badge-accent" style="background: rgba(0,242,254,0.15); color: var(--accent-cyan);">오탐률: ${matrix.overall_false_positive_rate}</span>
                <span class="badge badge-accent" style="background: rgba(157,78,223,0.15); color: var(--accent-purple);">PR 성공률: ${matrix.fix_pr_success_rate}</span>
            </div>
        </div>
    `;
}

function renderAccuracyMetricsPanel() {
    const reportTitleBox = document.querySelector("#tab-reports .page-title-box");
    if (!reportTitleBox) return;

    let metricsBox = document.getElementById("accuracy-metrics-panel");
    if (!metricsBox) {
        metricsBox = document.createElement("div");
        metricsBox.id = "accuracy-metrics-panel";
        metricsBox.className = "glass-panel";
        metricsBox.style.cssText = "padding: 18px 24px; margin-bottom: 20px;";
        reportTitleBox.parentNode.insertBefore(metricsBox, reportTitleBox.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling);
    }

    const metrics = SECURITY_KNOWLEDGE_BASE.realworld_metrics;
    metricsBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 14px; color: var(--accent-gold); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-vial-circle-check"></i> Empirical Metric Sampling (Raw Logs Parsed)
            </h4>
            <span style="font-size: 11px; color: var(--text-muted);">${metrics.verification_method}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; text-align: center;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">Critical 발견율</span>
                <span style="font-size: 20px; font-weight: 800; color: var(--accent-green);">${metrics.critical_detection_rate}</span>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; text-align: center;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">오탐률 (False Positive)</span>
                <span style="font-size: 20px; font-weight: 800; color: var(--accent-cyan);">${metrics.false_positive_rate}</span>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; text-align: center;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">CPU & RAM Peak</span>
                <span style="font-size: 16px; font-weight: 700; color: var(--text-muted);">Not Measured</span>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; text-align: center;">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">PR 생성 소요시간</span>
                <span style="font-size: 20px; font-weight: 800; color: var(--accent-gold);">${metrics.avg_time_to_fix_pr}</span>
            </div>
        </div>
    `;
}

function renderAttackChainVisualizer() {
    const chainContainer = document.getElementById("attack-chain-container");
    if (!chainContainer) return;

    chainContainer.innerHTML = SECURITY_KNOWLEDGE_BASE.attack_simulations.map(sim => `
        <div class="attack-step-node" style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; padding: 14px; background: rgba(255,255,255,0.02); border-radius: 8px; border-left: 3px solid ${sim.status.includes('Critical') || sim.status.includes('Proven') || sim.status.includes('Blocked') ? 'var(--accent-red)' : 'var(--accent-cyan)'}">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(0,242,254,0.1); color: var(--accent-cyan); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">
                ${sim.step}
            </div>
            <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="font-size: 14px; color: var(--text-primary);">${sim.phase}</h4>
                    <span class="badge ${sim.status.includes('Critical') || sim.status.includes('Proven') || sim.status.includes('Blocked') ? 'badge-danger' : 'badge-accent'}">${sim.status}</span>
                </div>
                <p style="font-size: 13px; font-weight: 600; color: var(--accent-cyan); margin-top: 4px;">${sim.action}</p>
                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${sim.detail}</p>
            </div>
        </div>
    `).join("");
}

function renderVulnerabilityAccordion() {
    const container = document.getElementById("vuln-accordion-container");
    if (!container) return;

    container.innerHTML = SECURITY_KNOWLEDGE_BASE.vulnerabilities.map((vuln, idx) => `
        <div class="vuln-card">
            <div class="vuln-header" onclick="toggleVulnDetails('${vuln.id}')">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <span class="badge badge-accent" style="background: rgba(0,242,254,0.2); color: var(--accent-cyan); font-weight: 700; font-family: var(--font-mono);">${vuln.vulnerability_id}</span>
                    <span class="badge ${vuln.severity === 'Critical' ? 'badge-danger' : 'badge-accent'}">${vuln.severity}</span>
                    <div>
                        <h4 style="font-size: 15px; color: var(--text-primary);">${vuln.title}</h4>
                        <span style="font-size: 12px; color: var(--text-muted);">Type: ${vuln.type} | ${vuln.cve} | Status: ${vuln.evidence_status}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${vuln.automated_pr ? `<span class="badge badge-accent" style="background: rgba(255, 59, 92, 0.2); color: var(--accent-red); border-color: rgba(255, 59, 92, 0.4);"><i class="fa-solid fa-ban"></i> PR Gate Blocked & Alerted</span>` : ''}
                    <i class="fa-solid fa-chevron-down text-muted" id="icon-${vuln.id}"></i>
                </div>
            </div>
            <div class="vuln-body ${idx === 0 ? '' : 'hidden'}" id="body-${vuln.id}">
                
                ${vuln.automated_pr ? `
                <div style="margin-bottom: 20px; padding: 16px; background: rgba(255, 59, 92, 0.08); border: 1px solid rgba(255, 59, 92, 0.3); border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h5 style="font-size: 14px; color: var(--accent-red); display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-ban"></i> Security Gate Action: GitHub PR Status Set to FAILURE (Blocked)
                        </h5>
                        <a href="${vuln.automated_pr.pr_url}" target="_blank" class="btn btn-outline" style="padding: 4px 10px; font-size: 11px; color: var(--accent-red); border-color: rgba(255, 59, 92, 0.4);">
                            <i class="fa-solid fa-up-right-from-square"></i> GitHub PR #${vuln.automated_pr.pr_id} 보기
                        </a>
                    </div>
                    <p style="font-size: 12px; color: var(--text-primary); font-weight: 600;">${vuln.automated_pr.pr_title}</p>
                    <div style="display: flex; gap: 14px; font-size: 11px; color: var(--text-muted); margin-top: 6px;">
                        <span>🌿 Branch: <code class="text-cyan">${vuln.automated_pr.branch_name}</code></span>
                        <span>📣 Notification: <span class="text-green font-bold"><i class="fa-brands fa-slack"></i> Slack #sec-alerts-devsecops Dispatched</span></span>
                    </div>
                </div>
                ` : ''}

                ${vuln.validation_pipeline ? `
                <div style="margin-bottom: 20px; padding: 16px; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 8px;">
                    <h5 style="font-size: 13px; color: var(--accent-cyan); margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-microchip"></i> Hypothesis ➔ Test Case ➔ Sandbox Validation Engine
                    </h5>
                    <div style="font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px;">
                        <div><strong style="color: var(--text-primary);">💡 가설 (Hypothesis):</strong> ${vuln.validation_pipeline.hypothesis}</div>
                        <div><strong style="color: var(--text-primary);">🧪 실행 테스트케이스:</strong> <code class="text-cyan">${vuln.validation_pipeline.generated_testcase}</code></div>
                        <div><strong style="color: var(--text-primary);">📊 샌드박스 결과:</strong> <span class="text-red">${vuln.validation_pipeline.sandbox_execution_result}</span></div>
                    </div>
                </div>
                ` : ''}

                ${vuln.confidence_scoring ? `
                <div style="margin-bottom: 20px; padding: 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-glass); border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h5 style="font-size: 14px; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-chart-pie"></i> Finding Confidence Score (신뢰도 산정 지표: ${vuln.confidence_scoring.total_score} / 100점)
                        </h5>
                        <span style="font-size: 11px; color: var(--text-muted);">Weighted Score Model</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                        <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; text-align: center;">
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">Evidence Proof (40%)</span>
                            <span style="font-size: 18px; font-weight: 800; color: var(--accent-green);">${vuln.confidence_scoring.breakdown.evidence_proof.score} / 40</span>
                            <span style="font-size: 10px; color: var(--text-secondary); display: block;">${vuln.confidence_scoring.breakdown.evidence_proof.status}</span>
                        </div>
                        <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; text-align: center;">
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">Exploitability (30%)</span>
                            <span style="font-size: 18px; font-weight: 800; color: var(--accent-cyan);">${vuln.confidence_scoring.breakdown.exploitability.score} / 30</span>
                            <span style="font-size: 10px; color: var(--text-secondary); display: block;">${vuln.confidence_scoring.breakdown.exploitability.status}</span>
                        </div>
                        <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; text-align: center;">
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">Impact Risk (20%)</span>
                            <span style="font-size: 18px; font-weight: 800; color: var(--accent-red);">${vuln.confidence_scoring.breakdown.impact_risk.score} / 20</span>
                            <span style="font-size: 10px; color: var(--text-secondary); display: block;">${vuln.confidence_scoring.breakdown.impact_risk.status}</span>
                        </div>
                        <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; text-align: center;">
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">CodeBERT (10%)</span>
                            <span style="font-size: 18px; font-weight: 800; color: var(--accent-gold);">${vuln.confidence_scoring.breakdown.ai_reasoning.score} / 10</span>
                            <span style="font-size: 10px; color: var(--text-secondary); display: block;">${vuln.confidence_scoring.breakdown.ai_reasoning.status}</span>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${vuln.evidence ? `
                <div style="margin-bottom: 20px; padding: 16px; background: rgba(5,8,15,0.8); border: 1px solid var(--border-glow); border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <h5 style="font-size: 13px; color: var(--accent-gold); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-fingerprint text-green"></i> Cryptographic Evidence Verification Metadata (변조 방지 검증)
                            </h5>
                            <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">Evidence ID: ${vuln.evidence_metadata.evidence_id} | SHA-256: ${vuln.evidence_metadata.sha256_hash.substring(0, 24)}...</span>
                        </div>
                        <span class="badge badge-accent" style="background: rgba(0,230,118,0.15); color: var(--accent-green);"><i class="fa-solid fa-lock"></i> HMAC Signed</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 11px; color: var(--text-secondary); background: rgba(255,255,255,0.02); padding: 10px; border-radius: 6px; margin-bottom: 12px;">
                        <div>⏱️ Timestamp: <span class="font-mono text-muted">${vuln.evidence_metadata.timestamp_utc}</span></div>
                        <div>🧪 Replay Test: <span class="text-green">${vuln.evidence_metadata.replay_success_rate}</span></div>
                        <div>🐳 Sandbox ID: <span class="font-mono text-cyan">${vuln.evidence_metadata.sandbox_container_id}</span></div>
                    </div>
                    
                    <div class="code-diff-grid">
                        <div class="diff-box vulnerable">
                            <span style="color: var(--accent-cyan); font-weight: 700; display: block; margin-bottom: 6px;">🌐 Captured HTTP / Binary Evidence Packet</span>
                            <pre><code style="color: #67e8f9;">${escapeHtml(vuln.evidence.request)}</code></pre>
                        </div>
                        <div class="diff-box vulnerable" style="border-color: rgba(255,59,92,0.4);">
                            <span style="color: var(--accent-red); font-weight: 700; display: block; margin-bottom: 6px;">📥 Exploited Response / Decompiled Payload Output</span>
                            <pre><code style="color: #f87171;">${escapeHtml(vuln.evidence.response)}</code></pre>
                        </div>
                    </div>

                    <div style="margin-top: 14px; padding: 12px; background: rgba(0,0,0,0.5); border-radius: 6px; border: 1px dashed var(--border-glass);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 12px; font-weight: 700; color: var(--accent-cyan);"><i class="fa-solid fa-terminal"></i> Reproducible One-Click Command</span>
                            <button class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;" onclick="copyCurl('${vuln.id}')"><i class="fa-regular fa-copy"></i> 명령어 복사</button>
                        </div>
                        <pre><code id="curl-${vuln.id}" style="font-size: 11px; color: #a5f3fc;">${escapeHtml(vuln.curl_replay)}</code></pre>
                    </div>
                </div>
                ` : ''}

                <div style="margin-bottom: 16px;">
                    <h5 style="font-size: 13px; color: var(--accent-cyan); margin-bottom: 6px;"><i class="fa-solid fa-circle-info"></i> 문제 설명 및 영향도</h5>
                    <p style="font-size: 13px; color: var(--text-secondary);">${vuln.description}</p>
                    <p style="font-size: 12px; color: var(--accent-red); margin-top: 6px; font-weight: 600;">영향: ${vuln.impact}</p>
                </div>

                <div style="margin-bottom: 16px;">
                    <h5 style="font-size: 13px; color: var(--accent-red); margin-bottom: 6px;"><i class="fa-solid fa-skull"></i> 공격 시나리오 (Attack Scenario)</h5>
                    <ul style="font-size: 12px; color: var(--text-secondary); padding-left: 18px;">
                        ${vuln.attack_scenario.map(s => `<li style="margin-bottom: 4px;">${s}</li>`).join("")}
                    </ul>
                </div>

                <div>
                    <h5 style="font-size: 13px; color: var(--accent-green); margin-bottom: 6px;"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Fix Assistant - 시정 코드 Diff</h5>
                    <div class="code-diff-grid">
                        <div class="diff-box vulnerable">
                            <span style="color: var(--accent-red); font-weight: 700; display: block; margin-bottom: 6px;">❌ 취약한 소스코드 / 설정</span>
                            <pre><code style="color: #f87171;">${escapeHtml(vuln.vulnerable_code)}</code></pre>
                        </div>
                        <div class="diff-box fixed">
                            <span style="color: var(--accent-green); font-weight: 700; display: block; margin-bottom: 6px;">✅ AI 시정 코드 (Fix Applied)</span>
                            <pre><code style="color: #4ade80;">${escapeHtml(vuln.fixed_code)}</code></pre>
                        </div>
                    </div>
                    <p style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">💡 조치 이유: ${vuln.remediation_reason}</p>
                </div>
            </div>
        </div>
    `).join("");
}

window.copyCurl = function(vulnId) {
    const codeEl = document.getElementById(`curl-${vulnId}`);
    if (codeEl) {
        navigator.clipboard.writeText(codeEl.textContent);
        alert("재현 명령어 복사 완료!");
    }
};

window.toggleVulnDetails = function(vulnId) {
    const body = document.getElementById(`body-${vulnId}`);
    const icon = document.getElementById(`icon-${vulnId}`);
    if (body) {
        body.classList.toggle("hidden");
        if (icon) {
            icon.classList.toggle("fa-chevron-down");
            icon.classList.toggle("fa-chevron-up");
        }
    }
};

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
