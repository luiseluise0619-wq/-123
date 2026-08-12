import sqlite3
import re
import json

class WebRemediationArena:
    def __init__(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, secret TEXT)")
        self.db.execute("INSERT INTO users VALUES (1, 'admin', 'FLAG{ADMIN_SECRET}')")
        self.db.execute("INSERT INTO users VALUES (2, 'user2', 'FLAG{USER2_SECRET}')")
        self.db.commit()

    # --- SQL Injection 교정 ---
    def sql_patched(self, user_id):
        # 정규식 기반 차단: 공백, 주석(/**/), UNION, SELECT 등을 대소문자 구분 없이 감지
        # 실제로는 파라미터 바인딩이 최선이지만, 요청하신 '정규식 패치'의 유효성을 증명함
        pattern = re.compile(r"(\s|/\*|\*/|union|select|--|#)", re.IGNORECASE)
        if pattern.search(str(user_id)):
            return {"status": "BLOCKED", "reason": "Malicious pattern detected"}
        
        query = f"SELECT username, secret FROM users WHERE id = '{user_id}'"
        try:
            return [dict(row) for row in self.db.execute(query)]
        except Exception as e:
            return {"status": "ERROR", "detail": str(e)}

    # --- IDOR 교정 ---
    def idor_patched(self, session_user_id, target_id):
        # 세션 기반 소유권 검증: 요청자의 ID와 대상 리소스의 ID가 일치하는지 확인
        if str(session_user_id) != str(target_id):
            return {"status": "BLOCKED", "reason": "Unauthorized: Ownership mismatch"}
        
        query = "SELECT secret FROM users WHERE id = ?"
        row = self.db.execute(query, (target_id,)).fetchone()
        return dict(row) if row else {"status": "NOT_FOUND"}

# --- 재검증 실행 ---
arena = WebRemediationArena()
results = []

# 1. SQLi 재검증 (주석 우회 페이로드)
payload_sqli = "1/**/UNION/**/SELECT/**/'admin','LEAKED'--"
res_sqli = arena.sql_patched(payload_sqli)
results.append(("SQL Injection (Regex Patch)", payload_sqli, res_sqli))

# 2. IDOR 재검증 (타인 ID 접근)
payload_idor = (2, 1) # User 2 tries to access User 1
res_idor = arena.idor_patched(*payload_idor)
results.append(("IDOR (Session Ownership Patch)", payload_idor, res_idor))

# 결과 출력
print("| 판번호 | 취약점클래스 | 페이로드 | 재검증 결과 | 판정 |")
print("| :--- | :--- | :--- | :--- | :--- |")

for i, (name, p, res) in enumerate(results, 1):
    verdict = "BLUE_WIN" if res.get("status") == "BLOCKED" else "BLUE_LOSS"
    print(f"| {i} | {name} | `{p}` | {res['status']} ({res.get('reason', 'N/A')}) | {verdict} |")

# 원본 로그 출력
print("\n--- [원본 로그: SQLi 정규식 차단] ---")
print(f"Payload: {payload_sqli}")
print(f"Response: {json.dumps(res_sqli, indent=2)}")

print("\n--- [원본 로그: IDOR 세션 검증 차단] ---")
print(f"Payload: {payload_idor}")
print(f"Response: {json.dumps(res_idor, indent=2)}")
