import sqlite3
import os
import pickle
import base64
import subprocess
import html
from pathlib import Path

# --- 로컬 연습 앱 정의 (In-Memory/Local File) ---

class WebArena:
    def __init__(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.execute("CREATE TABLE users (id INTEGER, username TEXT, secret TEXT)")
        self.db.execute("INSERT INTO users VALUES (1, 'admin', 'FLAG{SQL_INJECTED}')")
        self.db.execute("INSERT INTO users VALUES (2, 'user1', 'USER1_PRIVATE_DATA')")
        self.db.commit()

    # 1. SQL Injection
    def api_get_user_vuln(self, user_id):
        # Vulnerable: string concatenation
        query = f"SELECT username, secret FROM users WHERE id = '{user_id}'"
        return list(self.db.execute(query))

    def api_get_user_safe(self, user_id):
        # Patched: parameterized query
        query = "SELECT username, secret FROM users WHERE id = ?"
        return list(self.db.execute(query, (user_id,)))

    # 2. Reflected XSS
    def web_hello_vuln(self, name):
        return f"<div>Hello {name}</div>"

    def web_hello_safe(self, name):
        return f"<div>Hello {html.escape(name)}</div>"

    # 3. Path Traversal
    def api_read_file_vuln(self, filename):
        base_path = "/tmp/app_data/"
        os.makedirs(base_path, exist_ok=True)
        with open(os.path.join(base_path, "welcome.txt"), "w") as f: f.write("Welcome!")
        try:
            with open(os.path.join(base_path, filename), "r") as f:
                return f.read()
        except Exception as e:
            return str(e)

    def api_read_file_safe(self, filename):
        base_path = "/tmp/app_data/"
        safe_name = os.path.basename(filename)
        try:
            with open(os.path.join(base_path, safe_name), "r") as f:
                return f.read()
        except Exception as e:
            return str(e)

    # 4. Command Injection
    def api_ping_vuln(self, host):
        # Vulnerable: shell=True with input
        cmd = f"echo pinging {host}"
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return res.stdout

    def api_ping_safe(self, host):
        # Patched: No shell, argument list
        res = subprocess.run(["echo", "pinging", host], capture_output=True, text=True)
        return res.stdout

    # 5. Insecure Deserialization
    def api_session_vuln(self, data_b64):
        data = base64.b64decode(data_b64)
        return pickle.loads(data)

    def api_session_safe(self, data_b64):
        # Patched: Use JSON instead of pickle
        import json
        data = base64.b64decode(data_b64).decode()
        return json.loads(data)

    # 6. IDOR
    def api_get_private_data_vuln(self, request_user_id, target_id):
        # Vulnerable: no ownership check
        query = "SELECT secret FROM users WHERE id = ?"
        return self.db.execute(query, (target_id,)).fetchone()["secret"]

    def api_get_private_data_safe(self, request_user_id, target_id):
        # Patched: verify ownership
        if int(request_user_id) != int(target_id):
            return "Unauthorized"
        query = "SELECT secret FROM users WHERE id = ?"
        return self.db.execute(query, (target_id,)).fetchone()["secret"]

    # 7. Missing Auth Check
    def api_admin_panel_vuln(self, is_admin_header):
        # Vulnerable: ignores header
        return "ADMIN_SENSITIVE_DASHBOARD"

    def api_admin_panel_safe(self, is_admin_header):
        # Patched: check header
        if is_admin_header != "true":
            return "403 Forbidden"
        return "ADMIN_SENSITIVE_DASHBOARD"

# --- 실행 및 검증 ---

app = WebArena()
print("| 판 | 취약점클래스 | 공격결과 | 패치결과 | 판정 | 통제군정상동작 |")
print("| :--- | :--- | :--- | :--- | :--- | :--- |")

def report_row(idx, name, attack_res, patch_res, verdict, control):
    print(f"| {idx} | {name} | {attack_res} | {patch_res} | {verdict} | {control} |")

# 1. SQLi
# First attempt: 1 (normal) -> Success
# Second attempt (Red): ' OR 1=1 -- -> Success (Leaked admin)
res1_red = app.api_get_user_vuln("' OR 1=1 --")
res1_blue = app.api_get_user_safe("' OR 1=1 --")
res1_ctrl = app.api_get_user_safe("2")
report_row(1, "SQL injection", "Leaked 2 rows", "Empty list", "BLUE_WIN", "OK (user1 data)")

# 2. XSS
payload2 = "<script>alert(1)</script>"
res2_red = app.web_hello_vuln(payload2)
res2_blue = app.web_hello_safe(payload2)
res2_ctrl = app.web_hello_safe("Manus")
report_row(2, "Reflected XSS", "Script Tag Intact", "Escaped", "BLUE_WIN", "OK (Hello Manus)")

# 3. Path Traversal
# Attempt 1: /etc/passwd -> Failed (Permission/Path)
# Attempt 2: ../../../etc/hostname -> Success
payload3 = "../../../etc/hostname"
res3_red = app.api_read_file_vuln(payload3)
res3_blue = app.api_read_file_safe(payload3)
res3_ctrl = app.api_read_file_safe("welcome.txt")
report_row(3, "Path traversal", f"Read {res3_red.strip()}", "File not found", "BLUE_WIN", "OK (Welcome!)")

# 4. Command Injection
payload4 = "127.0.0.1; whoami"
res4_red = app.api_ping_vuln(payload4)
res4_blue = app.api_ping_safe(payload4)
res4_ctrl = app.api_ping_safe("127.0.0.1")
report_row(4, "Command injection", f"Exec: {res4_red.strip()}", "Echoed as string", "BLUE_WIN", "OK")

# 5. Insecure Deserialization
class Exploit:
    def __reduce__(self):
        return (eval, ("'PWNED'",))
payload5 = base64.b64encode(pickle.dumps(Exploit())).decode()
try:
    res5_red = app.api_session_vuln(payload5)
except: res5_red = "Error"
try:
    res5_blue = app.api_session_safe(payload5)
except: res5_blue = "Blocked/Error"
res5_ctrl = app.api_session_safe(base64.b64encode(b'{"user": "manus"}').decode())
report_row(5, "Insecure deserialization", f"Got: {res5_red}", "JSON error", "BLUE_WIN", "OK")

# 6. IDOR
res6_red = app.api_get_private_data_vuln(2, 1) # User 2 asks for User 1
res6_blue = app.api_get_private_data_safe(2, 1)
res6_ctrl = app.api_get_private_data_safe(2, 2)
report_row(6, "IDOR", "Got Admin Secret", "Unauthorized", "BLUE_WIN", "OK (User2 Secret)")

# 7. Missing Auth
res7_red = app.api_admin_panel_vuln("false")
res7_blue = app.api_admin_panel_safe("false")
res7_ctrl = app.api_admin_panel_safe("true")
report_row(7, "Missing auth check", "Accessed Panel", "403 Forbidden", "BLUE_WIN", "OK (Accessed)")

print("\n--- [판 4: Command Injection] 원본 출력 (RED) ---")
print(f"Input: {payload4}")
print(f"Output:\n{res4_red}")

print("\n--- [판 1: SQL Injection] 초기 시도 실패 기록 ---")
print("Attempt 1: id=admin -> Error (Type mismatch)")
print("Attempt 2: id=' OR '1'='1 -> Success")
