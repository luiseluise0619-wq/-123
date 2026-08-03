"""
AEGIS.AI - Domain Intelligence & Synthetic Data Seeding Engine
File: domain_seeder.py
Description: Infers domain (Commerce, Ticketing, SNS, FinTech) and seeds target-tailored DB entities.
"""

import json
from typing import Dict, Any, List
from pydantic import BaseModel

class DomainSchema(BaseModel):
    domain_type: str
    target_entities: List[str]
    seed_users: List[Dict[str, str]]
    seed_business_data: Dict[str, Any]

class DomainIntelligenceSeeder:
    """
    서비스 도메인(E-Commerce, Ticketing, SNS 등)을 자동 감지하고
    맞춤형 DB 엔티티 및 테스트 시드 데이터를 생성하는 도메인 에이전트
    """
    def __init__(self, code_tokens: List[str]):
        self.code_tokens = code_tokens

    def classify_domain(self) -> str:
        print("🧠 [Domain Agent] Analyzing code semantics & routes for domain classification...")
        if any(t in self.code_tokens for t in ["ticket", "reservation", "seat", "cancel"]):
            return "TICKETING_SERVICE"
        if any(t in self.code_tokens for t in ["cart", "checkout", "coupon", "product"]):
            return "E_COMMERCE"
        if any(t in self.code_tokens for t in ["post", "comment", "follow", "feed"]):
            return "SNS_SOCIAL"
        return "GENERAL_SAAS"

    def generate_domain_seed_data(self, domain_type: str) -> DomainSchema:
        print(f"🌱 [Synthetic Seeder] Generating tailored DB Schema & Seed Data for: {domain_type}")
        
        if domain_type == "TICKETING_SERVICE":
            return DomainSchema(
                domain_type="TICKETING_SERVICE",
                target_entities=["User", "ConcertSeat", "TicketReservation", "Payment", "RefundRequest"],
                seed_users=[
                    {"email": "buyer_a@security.local", "role": "buyer", "id": "u-101"},
                    {"email": "buyer_b@security.local", "role": "buyer", "id": "u-102"}
                ],
                seed_business_data={
                    "concert": "Aegis Security Tech Conference 2026",
                    "seat_id": "VIP-A-12",
                    "ticket_price": 150000,
                    "refund_fee": 15000
                }
            )
        else:
            return DomainSchema(
                domain_type="E_COMMERCE",
                target_entities=["User", "Product", "Cart", "Order", "Payment", "Coupon", "Refund"],
                seed_users=[
                    {"email": "test_a@security.local", "role": "buyer", "id": "u-1001"},
                    {"email": "test_b@security.local", "role": "buyer", "id": "u-1002"}
                ],
                seed_business_data={
                    "product_name": "Demo Product License",
                    "price": 10000,
                    "coupon_code": "WELCOME_10"
                }
            )

if __name__ == "__main__":
    seeder = DomainIntelligenceSeeder(["ticket", "reservation", "seat", "cancel_booking", "refund"])
    domain = seeder.classify_domain()
    seed_schema = seeder.generate_domain_seed_data(domain)
    print("\n[+] Domain Intelligence Synthetic Seed Result:\n")
    print(json.dumps(seed_schema.model_dump(), indent=2, ensure_ascii=False))
