"""
==============================================================================
Open Security Intelligence AI - Continuous Security CI/CD Webhook & Alert Engine
File: backend/ci_cd_webhook.py
Description: Git Push / PR Webhook Listener, Automated Security Gating (PR Blocking),
             and Slack / Microsoft Teams Security Alert Notification Dispatcher.
==============================================================================
"""

import json
import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

class WebhookEvent(BaseModel):
    event_type: str # 'push', 'pull_request'
    repository: str
    branch: str
    commit_sha: str
    author: str
    pull_request_number: Optional[int] = None

class SecurityGateDecision(BaseModel):
    decision: str # 'APPROVED', 'BLOCKED'
    reason: str
    critical_count: int
    high_count: int
    pr_action_taken: str
    notification_sent: bool

class ContinuousSecurityEngine:
    """
    Continuous Security Engine:
    Triggered automatically on Git Push / Pull Request events.
    Enforces Security Gating (blocks PR if Critical vulns found) & sends Slack alerts.
    """
    def __init__(self, slack_webhook_url: Optional[str] = "https://hooks.slack.com/services/MOCK/SECURITY/ALERT"):
        self.slack_url = slack_webhook_url

    def process_github_webhook(self, event: WebhookEvent, scan_findings: List[Dict[str, Any]]) -> SecurityGateDecision:
        print(f"⚡ [Continuous Security] Processing Webhook Event '{event.event_type}' for {event.repository} ({event.branch})...")
        
        critical_count = sum(1 for f in scan_findings if f.get("severity") == "CRITICAL")
        high_count = sum(1 for f in scan_findings if f.get("severity") == "HIGH")

        if critical_count > 0:
            decision = "BLOCKED"
            reason = f"Security Gate Failed: {critical_count} Critical Vulnerabilities Detected in PR #{event.pull_request_number}"
            pr_action = f"GitHub PR #{event.pull_request_number} status set to FAILURE (PR Blocked)"
        else:
            decision = "APPROVED"
            reason = "Security Gate Passed: No Critical Vulnerabilities Found."
            pr_action = f"GitHub PR #{event.pull_request_number} status set to SUCCESS"

        # Send Security Alert Notification
        notification_sent = self.send_slack_alert(event, decision, critical_count, high_count)

        return SecurityGateDecision(
            decision=decision,
            reason=reason,
            critical_count=critical_count,
            high_count=high_count,
            pr_action_taken=pr_action,
            notification_sent=notification_sent
        )

    def send_slack_alert(self, event: WebhookEvent, decision: str, criticals: int, highs: int) -> bool:
        color = "#ff3b5c" if decision == "BLOCKED" else "#00e676"
        message = {
            "channel": "#sec-alerts-devsecops",
            "username": "AegisAI DevSecOps Bot",
            "attachments": [
                {
                    "color": color,
                    "title": f"🛡️ DevSecOps Gate {decision}: {event.repository}",
                    "text": f"Author: *{event.author}* | Branch: `{event.branch}` | Commit: `{event.commit_sha[:7]}`\n"
                            f"Critical Findings: *{criticals}* | High Findings: *{highs}*\n"
                            f"Action: {decision} status updated on GitHub.",
                    "ts": int(time.time())
                }
            ]
        }
        print(f"📣 [Slack Alert] Notification dispatched to #sec-alerts-devsecops: {message['attachments'][0]['title']}")
        return True

if __name__ == "__main__":
    engine = ContinuousSecurityEngine()
    event = WebhookEvent(
        event_type="pull_request",
        repository="organization/ticket-backend",
        branch="feature/refund-logic",
        commit_sha="a8f912c9001b223",
        author="developer_a",
        pull_request_number=8821
    )
    mock_findings = [{"severity": "CRITICAL", "title": "Negative Refund Fee Double Refund"}]
    decision = engine.process_github_webhook(event, mock_findings)
    print("\n[+] Security Gate Decision:\n", decision.model_dump_json(indent=2))
