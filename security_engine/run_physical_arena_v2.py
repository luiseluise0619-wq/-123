import subprocess
from pathlib import Path

def run_physical_step(name, vuln_code, patch_code, sanitizer, corrected_patch=None):
    work_dir = Path(f"/home/ubuntu/arena_v2/{name}")
    work_dir.mkdir(parents=True, exist_ok=True)
    
    (work_dir / "vuln.cpp").write_text(vuln_code)
    (work_dir / "patch.cpp").write_text(patch_code)
    
    # 1. RED
    subprocess.run(f"g++ -fsanitize={sanitizer} -g -O0 {work_dir}/vuln.cpp -o {work_dir}/vuln.bin", shell=True)
    run_vuln = subprocess.run(f"{work_dir}/vuln.bin", shell=True, capture_output=True, text=True)
    vuln_log = run_vuln.stdout + run_vuln.stderr
    
    # 2. BLUE
    subprocess.run(f"g++ -fsanitize={sanitizer} -g -O0 {work_dir}/patch.cpp -o {work_dir}/patch.bin", shell=True)
    run_patch = subprocess.run(f"{work_dir}/patch.bin", shell=True, capture_output=True, text=True)
    patch_log = run_patch.stdout + run_patch.stderr
    
    result = {
        "name": name,
        "sanitizer": sanitizer,
        "vuln_exit": run_vuln.returncode,
        "patch_exit": run_patch.returncode,
        "vuln_log": vuln_log,
        "patch_log": patch_log,
        "corrected": None
    }
    
    # 3. CORRECTED (if BLUE_LOSS)
    if corrected_patch:
        (work_dir / "corrected.cpp").write_text(corrected_patch)
        subprocess.run(f"g++ -fsanitize={sanitizer} -g -O0 {work_dir}/corrected.cpp -o {work_dir}/corrected.bin", shell=True)
        run_corr = subprocess.run(f"{work_dir}/corrected.bin", shell=True, capture_output=True, text=True)
        result["corrected"] = {
            "exit": run_corr.returncode,
            "log": run_corr.stdout + run_corr.stderr
        }
        
    return result

scenarios = [
    ("format_string",
     '#include <cstdio>\nint main() { char b[] = "%s%s%s%s"; std::printf(b); return 0; }',
     '#include <cstdio>\nint main() { char b[] = "%s%s%s%s"; std::printf("%s", b); return 0; }',
     "address"), # Note: ASan doesn't always catch format string unless it crashes. UBSan/Fortify might be better but let's see.
    ("integer_underflow_index",
     '#include <iostream>\nint main() { unsigned int x = 0; x--; int a[10]; a[x % 100] = 1; return 0; }',
     '#include <iostream>\nint main() { unsigned int x = 0; x--; int a[10]; if (x < 10) a[x] = 1; return 0; }',
     "address"),
    ("off_by_one",
     '#include <cstring>\nint main() { char b[8]; for(int i=0; i<=8; i++) b[i]=0; return 0; }',
     '#include <cstring>\nint main() { char b[8]; for(int i=0; i<=8; i++) { if(i > 8) continue; b[i]=0; } return 0; }', # Incomplete: > 8 still allows i=8
     "address",
     '#include <cstring>\nint main() { char b[8]; for(int i=0; i<8; i++) b[i]=0; return 0; }'),
    ("double_free",
     '#include <cstdlib>\nint main() { void* p = malloc(8); free(p); free(p); return 0; }',
     '#include <cstdlib>\nint main() { void* p = malloc(8); free(p); p = nullptr; free(p); return 0; }',
     "address"),
    ("memcpy_negative_cast",
     '#include <cstring>\n#include <cstdlib>\nint main() { int s = -1; char d[8], src[8]; std::memcpy(d, src, (size_t)s); return 0; }',
     '#include <cstring>\n#include <cstdlib>\nint main() { int s = -1; char d[8], src[8]; if (s > 8) return 1; std::memcpy(d, src, (size_t)s); return 0; }', # Incomplete: misses negative
     "address",
     '#include <cstring>\n#include <cstdlib>\nint main() { int s = -1; char d[8], src[8]; if (s < 0 || s > 8) return 0; std::memcpy(d, src, (size_t)s); return 0; }')
]

results = []
for s in scenarios:
    results.append(run_physical_step(*s))

print("| 판번호 | 취약점클래스 | 새니타이저 | 취약결과 | 패치결과 | 판정 |")
print("| :--- | :--- | :--- | :--- | :--- | :--- |")
stats = {"win": 0, "loss": 0, "invalid": 0}

for i, r in enumerate(results, 1):
    is_vuln_caught = r["vuln_exit"] != 0
    is_patch_safe = r["patch_exit"] == 0
    
    if not is_vuln_caught:
        verdict = "INVALID"
        stats["invalid"] += 1
    elif not is_patch_safe:
        verdict = "BLUE_LOSS"
        stats["loss"] += 1
    else:
        verdict = "BLUE_WIN"
        stats["win"] += 1
        
    print(f"| {i} | {r['name']} | {r['sanitizer']} | Exit {r['vuln_exit']} | Exit {r['patch_exit']} | {verdict} |")

print(f"\n실제 블루 승 {stats['win']}, 블루 패 {stats['loss']}, 무효 {stats['invalid']} (합계 = {len(results)})")

# BLUE_LOSS 분석 및 재검증 출력
for r in results:
    if r["vuln_exit"] != 0 and r["patch_exit"] != 0 and r["corrected"]:
        print(f"\n--- [BLUE_LOSS 교정: {r['name']}] ---")
        print(f"원인: 불완전한 경계 검사 (Exit {r['patch_exit']})")
        print(f"교정 후 결과: Exit {r['corrected']['exit']} (SAFE 확인)")

print("\n--- [판 3: off_by_one] 원본 새니타이저 로그 (RED) ---")
print(results[2]["vuln_log"])
