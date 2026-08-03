"""
실제 CVE 라벨 데이터 다운로더 (GitHub raw — 이 샌드박스에서 실제로 받아짐).

VulDeePecker(CWE-119, CWE-399) code gadget 을 내려받아 cvedata/ 에 저장한다.
라벨은 NVD 실제 CVE + NIST SARD 기반의 진짜 취약 여부.
"""

import os
import urllib.request

DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cvedata")

FILES = {
    # CWE-119: 버퍼 오버플로우 계열 (약 4만 gadget)
    "cwe119.txt": "https://raw.githubusercontent.com/CGCL-codes/VulDeePecker/master/CWE-119/CGD/cwe119_cgd.txt",
    # CWE-399: 자원 관리 오류 계열 (약 2만 gadget)
    "cwe399.txt": "https://raw.githubusercontent.com/CGCL-codes/VulDeePecker/master/CWE-399/CGD/cwe399_cgd.txt",
}


def main():
    os.makedirs(DEST, exist_ok=True)
    for name, url in FILES.items():
        out = os.path.join(DEST, name)
        if os.path.exists(out) and os.path.getsize(out) > 0:
            print(f"  이미 있음: {name} ({os.path.getsize(out)//1024//1024}MB)"); continue
        try:
            print(f"  다운로드 {name} ...")
            urllib.request.urlretrieve(url, out)
            print(f"    저장 완료: {out} ({os.path.getsize(out)//1024//1024}MB)")
        except Exception as e:
            print(f"    실패({name}): {str(e)[:80]}")
    print("\n완료 → 이제 `python cve_train.py` 로 실제 CVE 라벨 학습 실행")


if __name__ == "__main__":
    main()
