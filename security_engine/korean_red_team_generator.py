"""
Korean Red-Team scenario generator for AegisAI.

The generator creates Korean, structured training scenarios for a local Red-Team /
Blue-Team loop. It emits static code-pattern descriptions only; it never sends a
payload to a target, opens a network connection, or executes generated source.
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Optional


KOREAN_ATTACK_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "KR_SQLI_01",
        "category": "SQL Injection",
        "title": "사용자 입력값 검증 누락으로 인한 SQL 삽입 위험",
        "description": "로그인 입력값이 SQL 문장에 문자열 결합으로 들어가는지 정적 분석하는 교육 시나리오입니다.",
        "attack_indicator": "교육용 토큰: 사용자 입력이 문자열 결합 SQL에 직접 포함됨",
        "vulnerable_code_pattern": "query = f\"SELECT ... WHERE username = '{username}'\"",
        "blue_team_fix": "파라미터 바인딩을 사용하고 입력값을 SQL 문자열과 분리합니다.",
    },
    {
        "id": "KR_CMD_02",
        "category": "Command Injection",
        "title": "사용자 입력과 운영체제 명령 처리의 결합 위험",
        "description": "외부 입력이 쉘 명령 문자열에 결합되는지 정적 분석하는 교육 시나리오입니다.",
        "attack_indicator": "교육용 토큰: 외부 입력이 명령 실행 API의 문자열 인자로 연결됨",
        "vulnerable_code_pattern": "subprocess.call(command_text, shell=True)",
        "blue_team_fix": "쉘을 사용하지 않고 허용 목록 기반 인자 배열과 안전한 API를 사용합니다.",
    },
    {
        "id": "KR_XSS_03",
        "category": "Cross-Site Scripting",
        "title": "출력값 인코딩 누락에 따른 XSS 위험",
        "description": "사용자 입력이 HTML 출력 컨텍스트에서 인코딩 없이 렌더링되는지 정적 분석하는 시나리오입니다.",
        "attack_indicator": "교육용 토큰: 사용자 입력이 HTML 출력 컨텍스트에 직접 삽입됨",
        "vulnerable_code_pattern": "return render_html(user_comment)",
        "blue_team_fix": "출력 컨텍스트에 맞는 자동 이스케이프와 허용 목록 정화를 적용합니다.",
    },
    {
        "id": "KR_PATH_04",
        "category": "Path Traversal",
        "title": "파일 경로 정규화 및 허용 목록 검증 누락",
        "description": "외부 입력이 기준 디렉터리 밖의 파일 경로로 해석될 수 있는지 정적 분석하는 시나리오입니다.",
        "attack_indicator": "교육용 토큰: 사용자 경로가 기준 디렉터리 경계 검증 없이 파일 API로 전달됨",
        "vulnerable_code_pattern": "open(base_dir / user_filename, 'r')",
        "blue_team_fix": "경로를 정규화하고 기준 디렉터리 내부인지 확인한 뒤 허용 목록을 적용합니다.",
    },
]


class KoreanRedTeamGenerator:
    """Template-guided local scenario model with an optional future LLM adapter."""

    model_name = "AegisAI-RedTeam-KR"
    language = "ko"
    safety_scope = "static scenario text only; no payload delivery or source execution"

    def __init__(self, scenarios: Optional[List[Dict[str, Any]]] = None, seed: Optional[int] = None):
        self.scenarios = list(scenarios or KOREAN_ATTACK_TEMPLATES)
        self._random = random.Random(seed)

    def generate_scenario(self, category: Optional[str] = None) -> Dict[str, Any]:
        """Generate one Korean scenario from an audited local catalogue."""
        candidates = self.scenarios
        if category:
            filtered = [s for s in self.scenarios if category.lower() in s["category"].lower()]
            candidates = filtered or candidates
        selected = dict(self._random.choice(candidates))
        return {
            "agent": self.model_name,
            "language": self.language,
            "generator_type": "template-guided local scenario model",
            "safety_scope": self.safety_scope,
            "scenario": selected,
        }

    def simulate_attack_and_defense(self, scenario_id: str) -> Dict[str, Any]:
        """Run a metadata-only Red/Blue exercise; no attack is sent anywhere."""
        scenario = next((s for s in self.scenarios if s["id"] == scenario_id), self.scenarios[0])
        return {
            "scenario_id": scenario["id"],
            "language": self.language,
            "korean_title": scenario["title"],
            "red_team_action": f"정적 공격 시뮬레이션: {scenario['attack_indicator']}",
            "blue_team_response": scenario["blue_team_fix"],
            "judge_verification": "로컬 정적 분석 심판에 전달할 교육 메타데이터 생성 완료",
            "source_executed": False,
            "network_contacted": False,
            "patch_applied_automatically": False,
            "requires_static_rescan": True,
        }

    def run_rounds(self, rounds: int = 4) -> Dict[str, Any]:
        """Create bounded Korean rounds for the Blue-Team to evaluate locally."""
        if not 1 <= rounds <= 16:
            raise ValueError("rounds must be between 1 and 16")
        rounds_out: List[Dict[str, Any]] = []
        for index in range(rounds):
            generated = self.generate_scenario()
            scenario = generated["scenario"]
            exercise = self.simulate_attack_and_defense(scenario["id"])
            rounds_out.append({
                "round": index + 1,
                "scenario": generated,
                "exercise": exercise,
                "blue_team_status": "awaiting_static_rescan",
            })
        return {
            "agent": self.model_name,
            "language": self.language,
            "rounds": rounds_out,
            "safety_scope": self.safety_scope,
        }
