import sqlite3
import os
import base64
import json
import html
from pathlib import Path

class WebDeepArena:
    def __init__(self):
        # 인메모리 DB 초기화
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, secret TEXT)")
        self.db.execute("INSERT INTO users VALUES (1, 'admin', 'FLAG{REAL_SQL_INJECTED}')")
        self.db.execute("INSERT INTO users VALUES (2, 'alice', 'ALICE_PRIVATE_KEY')")
        self.db.execute("INSERT INTO users VALUES (3, 'bob', 'BOB_PRIVATE_KEY')")
        self.db.commit()

    # --- SQL Injection (Deep) ---
    def sql_vuln(self, user_id):
        # 취약: 문자열 결합 (UNION 기반 공격 유도)
        query = f"SELECT username, secret FROM users WHERE id = {user_id}"
        try:
            return [dict(row) for row in self.db.execute(query)]
        except Exception as e:
            return {"error": str(e)}

    def sql_safe(self, user_id):
        # 패치: 파라미터 바인딩 + 입력 타입 검증
        try:
            val = int(user_id)
            query = "SELECT username, secret FROM users WHERE id = ?"
            return [dict(row) for row in self.db.execute(query, (val,))]
        except (ValueError, TypeError):
            return {"error": "Invalid input type"}
        except Exception as e:
            return {"error": str(e)}

    # --- IDOR (Deep) ---
    def idor_vuln(self, session_user_id, target_id):
        # 취약: 권한 확인 없이 ID로만 조회
        query = "SELECT secret FROM users WHERE id = ?"
        row = self.db.execute(query, (target_id,)).fetchone()
        return dict(row) if row else None

    def idor_safe(self, session_user_id, target_id):
        # 패치: 소유권 확인 (Session User ID == Target ID)
        if str(session_user_id) != str(target_id):
            return {"error": "Unauthorized: You cannot access other users' data"}
        query = "SELECT secret FROM users WHERE id = ?"
        row = self.db.execute(query, (target_id,)).fetchone()
        return dict(row) if row else None

    # --- Path Traversal (Deep) ---
    def path_vuln(self, path):
        # 취약: 필터링 없는 파일 읽기
        full_path = Path("/tmp/web_data") / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open("/tmp/web_data/config.json", "w") as f: f.write('{"db_pass": "P@ssword"}')
        try:
            return full_path.read_text()
        except Exception as e:
            return str(e)

    def path_safe(self, path):
        # 패치: basename 추출 및 화이트리스트 기반 접근
        safe_name = os.path.basename(path)
        allowed = ["config.json", "public.txt"]
        if safe_name not in allowed:
            return "Error: Access Denied"
        full_path = Path("/tmp/web_data") / safe_name
        try:
            return full_path.read_text()
        except Exception as e:
            return str(e)

# --- 시뮬레이션 실행기 ---
arena = WebDeepArena()

def run_test(name, vuln_func, safe_func, payloads, normal_input):
    print(f"\n--- [취약점 클래스: {name}] ---")
    
    # 1. RED: 공격 시도
    attack_results = []
    for p in payloads:
        res = vuln_func(*p) if isinstance(p, tuple) else vuln_func(p)
        attack_results.append((p, res))
    
    # 2. BLUE: 패치 후 재공격
    patch_results = []
    for p in payloads:
        res = safe_func(*p) if isinstance(p, tuple) else safe_func(p)
        patch_results.append((p, res))
        
    # 3. CONTROL: 정상 동작 확인
    ctrl_res = safe_func(*normal_input) if isinstance(normal_input, tuple) else safe_func(normal_input)
    
    return {
        "name": name,
        "attack": attack_results,
        "patch": patch_results,
        "control": ctrl_res
    }

# 테스트 데이터 정의
test_cases = [
    ("SQL Injection", arena.sql_vuln, arena.sql_safe, 
     ["2 UNION SELECT username, secret FROM users --"], "2"),
    
    ("IDOR", arena.idor_vuln, arena.idor_safe, 
     [(2, 1)], (2, 2)), # User 2 tries to access User 1's data
    
    ("Path Traversal", arena.path_vuln, arena.path_safe, 
     ["../../etc/passwd"], "config.json")
]

all_results = []
for tc in test_cases:
    all_results.append(run_test(*tc))

# 결과 표 출력
print("\n" + "="*80)
print("| 판 | 취약점클래스 | 공격결과 (RED) | 패치결과 (BLUE) | 판정 | 통제군정상동작 |")
print("| :--- | :--- | :--- | :--- | :--- | :--- |")

for i, r in enumerate(all_results, 1):
    # 공격 성공 여부 판단 (데이터 유출 여부 등)
    attack_success = False
    if r["name"] == "SQL Injection":
        attack_success = len(r["attack"][0][1]) > 1 # 2개 이상의 로우 유출
    elif r["name"] == "IDOR":
        attack_success = "secret" in r["attack"][0][1] and "FLAG" in r["attack"][0][1].get("secret", "") or "admin" in str(r["attack"][0][1])
    elif r["name"] == "Path Traversal":
        attack_success = "root:" in r["attack"][0][1] or "Permission denied" not in r["attack"][0][1] and len(r["attack"][0][1]) > 0
    
    # 패치 성공 여부
    patch_blocked = False
    if r["name"] == "SQL Injection":
        patch_blocked = "error" in r["patch"][0][1] or len(r["patch"][0][1]) <= 1
    elif r["name"] == "IDOR":
        patch_blocked = "error" in r["patch"][0][1]
    elif r["name"] == "Path Traversal":
        patch_blocked = "Access Denied" in r["patch"][0][1]
        
    verdict = "BLUE_WIN" if (attack_success and patch_blocked) else "BLUE_LOSS"
    
    # 통제군 확인
    ctrl_ok = "OK" if ("error" not in str(r["control"]) and len(str(r["control"])) > 0) else "FAIL"
    
    print(f"| {i} | {r['name']} | {'SUCCESS' if attack_success else 'BLOCKED'} | {'BLOCKED' if patch_blocked else 'FAILED'} | {verdict} | {ctrl_ok} |")

# 원본 로그 출력 (SQL Injection 예시)
print("\n--- [원본 로그: SQL Injection 공격 (RED)] ---")
print(f"Payload: {all_results[0]['attack'][0][0]}")
print(f"Response: {json.dumps(all_results[0]['attack'][0][1], indent=2)}")

print("\n--- [원본 로그: SQL Injection 차단 (BLUE)] ---")
print(f"Payload: {all_results[0]['patch'][0][0]}")
print(f"Response: {json.dumps(all_results[0]['patch'][0][1], indent=2)}")
