"""
Agent 3: Business Logic Agent — HONEST (no fabricated exploits).

이전 버전은 코드를 실제로 분석하지 않고, 티켓/커머스 엔드포인트면 무조건
"음수 환불 이중지급" 같은 구체 익스플로잇 페이로드를 하드코딩해 반환했다(조작).
비즈니스 로직 결함은 정적분석으로 '증명'할 수 없다 — 도메인 의도를 알아야 한다.

이 버전은 정직하게 동작한다:
  - 코드/엔드포인트에서 금전·권한 관련 '위험 신호'(가격/환불/수량/역할 등 신뢰
    경계 후보)를 실제로 스캔한다.
  - 발견 시 "취약함"이라 단정하지 않고 needs_manual_review 로 표기하고,
    사람이/LLM이 확인할 체크리스트를 제시한다(증거 없는 익스플로잇 날조 없음).
"""

import re
from typing import List

from pydantic import BaseModel

# 신뢰경계에서 조작되면 위험한 신호들(존재 자체는 취약이 아니라 '검토 필요')
RISK_SIGNALS = {
    "price_amount": r"\b(price|amount|total|fee|refund|discount|balance)\b",
    "quantity": r"\b(qty|quantity|count|stock)\b",
    "authz_role": r"\b(is_admin|role|is_owner|user_id|owner_id|permission)\b",
    "direct_object_ref": r"\b(id|uuid)\s*=\s*request\.|params\[|query\[",
}


class LogicReview(BaseModel):
    risk_signals_found: List[str]
    needs_manual_review: bool
    review_checklist: List[str]
    note: str


class BusinessLogicAgent:
    """비즈니스 로직 '검토 필요' 신호만 정직하게 표기. 익스플로잇 날조 안 함."""

    def analyze_service_flow(self, endpoints: List[str], sample_code: str) -> LogicReview:
        blob = (" ".join(endpoints) + "\n" + (sample_code or "")).lower()
        found = [name for name, pat in RISK_SIGNALS.items()
                 if re.search(pat, blob)]
        checklist = []
        if "price_amount" in found:
            checklist.append("금액/환불/할인 값이 서버에서 재계산·검증되는가? "
                             "(클라이언트 값 신뢰 금지, 음수/0 경계 확인)")
        if "quantity" in found:
            checklist.append("수량/재고가 서버에서 검증되는가? (음수·초과 주문 차단)")
        if "authz_role" in found:
            checklist.append("권한/역할이 서버에서 강제되는가? (수평/수직 권한상승 확인)")
        if "direct_object_ref" in found:
            checklist.append("객체 ID 접근이 소유자 검증을 거치는가? (IDOR 확인)")
        return LogicReview(
            risk_signals_found=found,
            needs_manual_review=bool(found),
            review_checklist=checklist,
            note=("정적으로 '취약'이라 단정하지 않음. 이 신호들은 사람/LLM 검토가 "
                  "필요한 지점이며, 실제 취약 여부는 도메인 의도 확인 후 판정."),
        )


if __name__ == "__main__":
    agent = BusinessLogicAgent()
    code = "def cancel(req):\n    refund_fee = req.json['refund_fee']\n    return price - refund_fee\n"
    print(agent.analyze_service_flow(["/api/v1/tickets/cancel"], code).model_dump_json(indent=2))
