import os
import json
from openai import OpenAI

class LLMSecurityAgent:
    def __init__(self, role="red"):
        # 샌드박스에 사전 설정된 환경 변수를 사용하여 클라이언트 초기화
        self.client = OpenAI()
        self.role = role
        self.system_prompts = {
            "red": "You are a professional security researcher (Red Team). Your goal is to generate exploit payloads for given code or scenarios. Focus on technical accuracy and bypassing defenses. Output ONLY JSON with 'payload' and 'explanation' keys.",
            "blue": "You are a professional security engineer (Blue Team). Your goal is to provide secure code patches for given vulnerabilities. Focus on root cause remediation (e.g., parameterized queries, bounds checking). Output ONLY JSON with 'patch_code' and 'explanation' keys."
        }

    def get_command_result(self, user_instruction, target_context):
        prompt = f"Role: {self.role.upper()}\nInstruction: {user_instruction}\nContext: {target_context}\n\nProvide your response in JSON format."
        
        response = self.client.chat.completions.create(
            model="gpt-4o", # 샌드박스에서 지원하는 모델 사용
            messages=[
                {"role": "system", "content": self.system_prompts[self.role]},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)

if __name__ == "__main__":
    # 간단한 테스트
    agent = LLMSecurityAgent(role="red")
    print("Testing Red Team Agent...")
    try:
        res = agent.get_command_result("Generate a SQL injection payload using UNION", "Target table: users, column: secret")
        print(json.dumps(res, indent=2))
    except Exception as e:
        print(f"Error: {e}")
