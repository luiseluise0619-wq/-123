import subprocess
import json
import time
from pathlib import Path
from security_engine.dynamic_scenario_generator import DynamicScenarioGenerator

class AutonomousDuelLoop:
    def __init__(self, log_file="/home/ubuntu/arena/autonomous_duels.jsonl"):
        self.generator = DynamicScenarioGenerator()
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        self.round_count = 0

    def run_round(self):
        self.round_count += 1
        scenario = self.generator.generate()
        work_dir = Path(f"/home/ubuntu/arena/round_{self.round_count}")
        work_dir.mkdir(parents=True, exist_ok=True)
        
        vuln_file = work_dir / "vuln.cpp"
        patch_file = work_dir / "patch.cpp"
        vuln_file.write_text(scenario["vuln_code"])
        patch_file.write_text(scenario["patch_code"])
        
        # 1. RED 실행
        subprocess.run(f"g++ -fsanitize={scenario['sanitizer']} -g -O0 {vuln_file} -o {work_dir}/vuln.bin", shell=True)
        run_vuln = subprocess.run(f"{work_dir}/vuln.bin", shell=True, capture_output=True, text=True)
        
        # 2. BLUE 실행
        subprocess.run(f"g++ -fsanitize={scenario['sanitizer']} -g -O0 {patch_file} -o {work_dir}/patch.bin", shell=True)
        run_patch = subprocess.run(f"{work_dir}/patch.bin", shell=True, capture_output=True, text=True)
        
        # 3. 판정
        is_vuln_caught = run_vuln.returncode != 0
        is_patch_safe = run_patch.returncode == 0
        verdict = "BLUE_WIN" if (is_vuln_caught and is_patch_safe) else ("BLUE_LOSS" if is_vuln_caught else "INVALID")
        
        result = {
            "round": self.round_count,
            "type": scenario["type"],
            "sanitizer": scenario["sanitizer"],
            "verdict": verdict,
            "vuln_exit": run_vuln.returncode,
            "patch_exit": run_patch.returncode,
            "vuln_log_snippet": (run_vuln.stdout + run_vuln.stderr).split('\n')[:5],
            "timestamp": time.time()
        }
        
        with open(self.log_file, "a") as f:
            f.write(json.dumps(result) + "\n")
            
        return result

if __name__ == "__main__":
    loop = AutonomousDuelLoop()
    print(f"Starting Autonomous Duel Loop...")
    for _ in range(5):
        res = loop.run_round()
        print(f"Round {res['round']} | {res['type']} | {res['verdict']}")
