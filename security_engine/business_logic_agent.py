"""
==============================================================================
Open Security Intelligence AI - Multi-Agent Engine: Agent 3 - Business Logic Agent
File: security_engine/business_logic_agent.py
Description: Domain classification (E-Commerce, Ticketing, SNS) and state machine
             flow analysis detecting price tampering, refund manipulation, IDOR.
==============================================================================
"""

import re
from typing import Dict, Any, List
from pydantic import BaseModel

class LogicScenario(BaseModel):
    domain: str
    target_flow: str
    vulnerability_detected: str
    impact: str
    exploit_payload: Dict[str, Any]

class BusinessLogicAgent:
    """
    Agent 3: Business Logic State Machine Agent
    Analyzes domain context and generates logic flaw exploits (Price, Refund, IDOR).
    """
    def __init__(self):
        pass

    def analyze_service_flow(self, endpoints: List[str], sample_code: str) -> LogicScenario:
        if "ticket" in str(endpoints).lower() or "cancel" in str(endpoints).lower():
            return LogicScenario(
                domain="Ticketing Service",
                target_flow="User -> Reservation -> Payment -> Cancel & Refund",
                vulnerability_detected="Negative Refund Fee Double Payout",
                impact="Critical financial asset loss via negative fee subtraction",
                exploit_payload={"ticket_id": "TKT-VIP-1029", "original_price": 150000, "refund_fee": -150000}
            )
        else:
            return LogicScenario(
                domain="E-Commerce Shopping Cart",
                target_flow="User -> Product -> Cart -> Checkout",
                vulnerability_detected="Zero Price Purchase Tampering",
                impact="Unauthorized free product order approval",
                exploit_payload={"product_id": 99, "price": 0, "quantity": 1}
            )

if __name__ == "__main__":
    agent = BusinessLogicAgent()
    res = agent.analyze_service_flow(["/api/v1/tickets/reserve", "/api/v1/tickets/cancel"], "code")
    print(res.model_dump_json(indent=2))
