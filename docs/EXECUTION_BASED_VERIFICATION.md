# AegisAI 실행 기반 검증 보고서 (Execution-Based Verification)

본 보고서는 서사적 추정이나 지어낸 지표(예: 88% 성공률 등)를 전면 배제하고, 실제 C++ 코드를 AddressSanitizer(ASan)로 컴파일 및 실행하여 얻은 **실제 크래시 로그와 패치 검증 결과**만을 기록합니다.

---

### 1. 대상 취약점 분석 (CWE-121: Stack-based Buffer Overflow)
*   **파일**: `security_engine/test_overflow_harness.cpp`
*   **취약 코드**:
    ```cpp
    void process_packet_vulnerable(const char* net_input, std::size_t len) {
        char packet_buf[128];
        if (len < 512) {
            std::memcpy(packet_buf, net_input, len); // 128바이트 버퍼에 200바이트 복사 시 스택 오버플로우 발생
        }
    }
    ```

---

### 2. 실제 취약점 실행 결과 (AddressSanitizer 로그)
200바이트의 입력을 취약 함수에 주입했을 때 ASan이 포착한 실제 크래시 출력입니다:

```text
=== AegisAI Execution-Based Verification Harness ===
[*] Testing Vulnerable Function with 200 bytes input...
=================================================================
==13033==ERROR: AddressSanitizer: stack-buffer-overflow on address 0x7fb2715000a0 at pc 0x7fb273cfb303 bp 0x7ffd29798820 sp 0x7ffd29797fc8
WRITE of size 200 at 0x7fb2715000a0 thread T0
    #0 0x7fb273cfb302 in memcpy ../../../../src/libsanitizer/sanitizer_common/sanitizer_common_interceptors_memintrinsics.inc:115
    #1 0x56143d5da591 in process_packet_vulnerable(char const*, unsigned long) /home/ubuntu/-123/security_engine/test_overflow_harness.cpp:11
    #2 0x56143d5daa6b in main /home/ubuntu/-123/security_engine/test_overflow_harness.cpp:33
...
SUMMARY: AddressSanitizer: stack-buffer-overflow ../../../../src/libsanitizer/sanitizer_common/sanitizer_common_interceptors_memintrinsics.inc:115 in memcpy
==13033==ABORTING
```

---

### 3. 실제 패치 및 검증 결과
*   **패치 코드**:
    ```cpp
    void process_packet_safe(const std::vector<char>& net_input) {
        if (net_input.size() > 128) {
            throw std::runtime_error("packet exceeds 128-byte safety limit");
        }
        std::vector<char> packet_buf(net_input.size());
        if (!net_input.empty()) {
            std::memcpy(packet_buf.data(), net_input.data(), net_input.size());
        }
    }
    ```
*   **검증 실행 결과**:
    ```text
    mode=--safe input_bytes=200 buffer_bytes=128
    PATCH_RESULT=blocked
    reason=packet exceeds 128-byte safety limit
    SAFE_EXIT=0
    ```

---

### 4. 결론
가장 중요한 교훈은 **"그럴듯한 문장과 퍼센트 수치보다 철저한 실행 기반 검증(Execution-Based Verification)이 우선해야 한다"**는 점입니다. 향후 AegisAI의 모든 학습 및 검증 루프는 지어낸 서사 출력을 차단하고, 본 보고서와 같은 실제 컴파일 및 샌드박스 실행 결과만을 신뢰하도록 엄격히 통제됩니다.
