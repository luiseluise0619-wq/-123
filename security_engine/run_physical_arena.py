import os
import subprocess
from pathlib import Path

def run_step(name, vuln_code, patch_code, sanitizer):
    work_dir = Path(f"/home/ubuntu/arena/{name}")
    work_dir.mkdir(parents=True, exist_ok=True)
    
    vuln_file = work_dir / "vuln.cpp"
    patch_file = work_dir / "patch.cpp"
    vuln_file.write_text(vuln_code)
    patch_file.write_text(patch_code)
    
    # 1. RED (Vulnerable)
    compile_vuln = f"g++ -fsanitize={sanitizer} -g -O0 {vuln_file} -o {work_dir}/vuln.bin"
    subprocess.run(compile_vuln, shell=True, capture_output=True)
    
    run_vuln = subprocess.run(f"{work_dir}/vuln.bin", shell=True, capture_output=True, text=True)
    vuln_log = run_vuln.stdout + run_vuln.stderr
    vuln_exit = run_vuln.returncode
    
    # 2. BLUE (Patched)
    compile_patch = f"g++ -fsanitize={sanitizer} -g -O0 {patch_file} -o {work_dir}/patch.bin"
    subprocess.run(compile_patch, shell=True, capture_output=True)
    
    run_patch = subprocess.run(f"{work_dir}/patch.bin", shell=True, capture_output=True, text=True)
    patch_log = run_patch.stdout + run_patch.stderr
    patch_exit = run_patch.returncode
    
    return {
        "name": name,
        "sanitizer": sanitizer,
        "vuln_exit": vuln_exit,
        "patch_exit": patch_exit,
        "vuln_log": vuln_log,
        "patch_log": patch_log
    }

scenarios = [
    ("stack_buffer_overflow", 
     '#include <cstring>\nint main() { char b[8]; std::memcpy(b, "1234567890", 10); return 0; }',
     '#include <cstring>\nint main() { char b[8]; std::memcpy(b, "1234567", 7); return 0; }',
     "address"),
    ("heap_use_after_free",
     '#include <cstdlib>\nint main() { int* p = new int(1); delete p; return *p; }',
     '#include <cstdlib>\nint main() { int* p = new int(1); int v = *p; delete p; return 0; }',
     "address"),
    ("heap_buffer_overflow",
     '#include <cstdlib>\n#include <cstring>\nint main() { char* p = (char*)malloc(8); std::memcpy(p, "1234567890", 10); free(p); return 0; }',
     '#include <cstdlib>\n#include <cstring>\nint main() { char* p = (char*)malloc(16); std::memcpy(p, "1234567890", 10); free(p); return 0; }',
     "address"),
    ("signed_integer_overflow",
     '#include <climits>\nint main() { int x = INT_MAX; return x + 1; }',
     '#include <climits>\nint main() { long long x = INT_MAX; return (int)(x + 1); }',
     "undefined"),
    ("null_deref",
     'int main() { int* p = nullptr; return *p; }',
     'int main() { int* p = nullptr; if (p) return *p; return 0; }',
     "undefined"),
    ("stack_oob_read",
     'int main() { int a[4] = {1,2,3,4}; return a[10]; }',
     'int main() { int a[4] = {1,2,3,4}; int i = 2; if (i < 4) return a[i]; return 0; }',
     "address"),
    ("division_by_zero",
     'int main() { int x = 1, y = 0; return x / y; }',
     'int main() { int x = 1, y = 1; return x / y; }',
     "undefined"),
    ("dynamic_stack_oob",
     '#include <alloca.h>\nint main() { int* p = (int*)alloca(8); return p[10]; }',
     '#include <alloca.h>\nint main() { int* p = (int*)alloca(64); return p[0]; }',
     "address"),
    ("global_buffer_overflow",
     'char g[8]; int main() { g[10] = 1; return 0; }',
     'char g[16]; int main() { g[10] = 1; return 0; }',
     "address"),
    ("shift_overflow",
     'int main() { int x = 1; return x << 32; }',
     'int main() { int x = 1; return x << 16; }',
     "undefined")
]

results = []
for name, vuln, patch, san in scenarios:
    results.append(run_step(name, vuln, patch, san))

print("| 판번호 | 취약점클래스 | 새니타이저 | 취약실행결과 | 패치실행결과 | 판정 |")
print("| :--- | :--- | :--- | :--- | :--- | :--- |")
wins = 0
for i, r in enumerate(results, 1):
    # 취약 코드가 새니타이저에 걸려 죽었는가? (returncode != 0)
    # 패치가 exit 0으로 살아남았는가?
    is_vuln_caught = r["vuln_exit"] != 0
    is_patch_safe = r["patch_exit"] == 0
    verdict = "BLUE_WIN" if (is_vuln_caught and is_patch_safe) else ("BLUE_LOSS" if is_vuln_caught else "INVALID")
    if verdict == "BLUE_WIN": wins += 1
    print(f"| {i} | {r['name']} | {r['sanitizer']} | Exit {r['vuln_exit']} | Exit {r['patch_exit']} | {verdict} |")

print(f"\n실제 블루 승: {wins}/10")

# 5번 규칙: 최소 1판의 원본 로그 출력 (1번 판)
print("\n--- [판 1: stack_buffer_overflow] 원본 새니타이저 로그 ---")
print(results[0]["vuln_log"])
