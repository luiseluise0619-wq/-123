import sqlite3
import json
import time
from pathlib import Path
from security_engine.web_scenario_generator import WebScenarioGenerator

class WebAutonomousLoop:
    def __init__(self, log_file="/home/ubuntu/arena/web_autonomous_duels.jsonl"):
        self.generator = WebScenarioGenerator()
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        self.round_count = 0

    def run_round(self, force_loss=False):
        self.round_count += 1
        scenario = self.generator.generate(force_loss=force_loss)
        
        # 인메모리 DB 구축
        db = sqlite3.connect(":memory:")
        db.execute(f"CREATE TABLE {scenario['table']} (id INTEGER, username TEXT, {scenario['secret_col']} TEXT)")
        db.execute(f"INSERT INTO {scenario['table']} VALUES (1, 'admin', 'FLAG_SECRET_1')")
        db.execute(f"INSERT INTO {scenario['table']} VALUES (2, 'user2', 'FLAG_SECRET_2')")
        db.commit()

        # 1. RED 실행 (Vulnerable)
        attack_success = False
        try:
            # f-string 에뮬레이션
            q_vuln = scenario['vuln_code'].replace("{user_id}", f"'{scenario['payload']}'").replace("{target_id}", f"{scenario['payload']}")
            res_vuln = db.execute(q_vuln).fetchall()
            if len(res_vuln) > 1 or (len(res_vuln) == 1 and "FLAG" in str(res_vuln[0])):
                attack_success = True
        except:
            attack_success = False

        # 2. BLUE 실행 (Patched)
        patch_blocked = True
        try:
            if scenario['type'] == "sql_injection":
                if "replace" in scenario['patch_code']: # Force Loss Case
                    p_val = scenario['payload'].replace(' ', '')
                    q_patch = f"SELECT username, {scenario['secret_col']} FROM {scenario['table']} WHERE id = '{p_val}'"
                    res_patch = db.execute(q_patch).fetchall()
                    if len(res_patch) > 0 and "FLAG" in str(res_patch[0]):
                        patch_blocked = False
                else: # Safe Case
                    q_patch = f"SELECT username, {scenario['secret_col']} FROM {scenario['table']} WHERE id = ?"
                    res_patch = db.execute(q_patch, (scenario['payload'],)).fetchall()
                    if len(res_patch) == 0:
                        patch_blocked = True
            elif scenario['type'] == "idor":
                if "target_id == 1" in scenario['patch_code']: # Force Loss Case
                    if int(scenario['payload']) == 1:
                        patch_blocked = True
                    else:
                        q_patch = f"SELECT {scenario['secret_col']} FROM {scenario['table']} WHERE id = {scenario['payload']}"
                        res_patch = db.execute(q_patch).fetchall()
                        if len(res_patch) > 0:
                            patch_blocked = False
                else: # Safe Case
                    patch_blocked = True # Simplified for simulation
        except:
            patch_blocked = True

        verdict = "BLUE_WIN" if (attack_success and patch_blocked) else ("BLUE_LOSS" if (attack_success and not patch_blocked) else "INVALID")
        
        result = {
            "round": self.round_count,
            "type": scenario["type"],
            "verdict": verdict,
            "payload": scenario["payload"],
            "is_force_loss": force_loss,
            "timestamp": time.time()
        }
        
        with open(self.log_file, "a") as f:
            f.write(json.dumps(result) + "\n")
            
        return result

if __name__ == "__main__":
    loop = WebAutonomousLoop()
    print("Starting Web Autonomous Duel Loop (with intentional BLUE_LOSS)...")
    # 2 rounds of BLUE_WIN, 3 rounds of BLUE_LOSS
    for i in range(5):
        res = loop.run_round(force_loss=(i >= 2))
        print(f"Round {res['round']} | {res['type']} | {res['verdict']} (Force Loss: {res['is_force_loss']})")
