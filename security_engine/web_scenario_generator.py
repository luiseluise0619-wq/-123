import random
import string
import sqlite3
import json

class WebScenarioGenerator:
    def __init__(self):
        self.types = ["sql_injection", "idor"]

    def _rand_str(self, length=6):
        return ''.join(random.choices(string.ascii_lowercase, k=length))

    def generate(self, force_loss=False):
        v_type = random.choice(self.types)
        table_name = self._rand_str(8)
        secret_col = self._rand_str(6)
        
        if v_type == "sql_injection":
            # 시나리오: UNION 기반 데이터 유출
            vuln_code = f"SELECT username, {secret_col} FROM {table_name} WHERE id = " + "{user_id}"
            if force_loss:
                # 불완전 패치: 단순 공백 제거 (우회 가능)
                patch_code = f"user_id = str(user_id).replace(' ', '')\nquery = f'SELECT username, {secret_col} FROM {table_name} WHERE id = {{user_id}}'"
                payload = "1/**/UNION/**/SELECT/**/'admin','FLAG_LEAKED'--"
            else:
                # 완전 패치: 파라미터 바인딩
                patch_code = f"query = 'SELECT username, {secret_col} FROM {table_name} WHERE id = ?'\nparams = (user_id,)"
                payload = "1' OR '1'='1"
                
        elif v_type == "idor":
            # 시나리오: 타인 리소스 접근
            vuln_code = f"SELECT {secret_col} FROM {table_name} WHERE id = " + "{target_id}"
            if force_loss:
                # 불완전 패치: 블랙리스트 기반 (특정 ID만 막음)
                patch_code = f"if target_id == 1: return 'Access Denied'\nquery = f'SELECT {secret_col} FROM {table_name} WHERE id = {{target_id}}'"
                payload = "2" # admin(1)은 막았지만 user2(2) 데이터는 유출됨
            else:
                # 완전 패치: 세션 기반 소유권 확인
                patch_code = f"if session_user_id != target_id: return 'Unauthorized'\nquery = f'SELECT {secret_col} FROM {table_name} WHERE id = {{target_id}}'"
                payload = "1"

        return {
            "type": v_type,
            "table": table_name,
            "secret_col": secret_col,
            "vuln_code": vuln_code,
            "patch_code": patch_code,
            "payload": payload,
            "is_force_loss": force_loss
        }
