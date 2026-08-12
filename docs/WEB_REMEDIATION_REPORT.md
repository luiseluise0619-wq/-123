# 웹 취약점 교정 및 재검증 보고서 (Web Remediation & Re-verification)

이전 라운드에서 발생했던 **SQL Injection 우회** 및 **IDOR 권한 우회** 실패 사례에 대해 강력한 교정 패치를 적용하고, 실제 물리적 실행을 통해 `BLUE_WIN`으로 전환되었음을 증명합니다.

---

### 1. 교정 및 재검증 결과 요약

| 판번호 | 취약점클래스 | 적용 패치 기법 | 페이로드 | 재검증 결과 | 판정 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | SQL Injection | **정규식 기반 필터링** | `1/**/UNION/**/SELECT...` | **BLOCKED** | **BLUE_WIN** |
| 2 | IDOR | **세션 기반 소유권 검증** | `(2, 1)` | **BLOCKED** | **BLUE_WIN** |

---

### 2. 기술적 교정 상세

#### [SQL Injection: 정규식 필터링]
*   **기존 문제**: 공백 제거(`replace(' ', '')`)만으로는 `/**/` 주석을 이용한 우회를 막지 못함.
*   **교정 패치**: `re.compile(r"(\s|/\*|\*/|union|select|--|#)", re.IGNORECASE)`를 적용하여 주석 및 주요 SQL 키워드를 사전에 차단.
*   **물리적 증명**: `{"status": "BLOCKED", "reason": "Malicious pattern detected"}` 응답 확인.

#### [IDOR: 세션 소유권 검증]
*   **기존 문제**: 블랙리스트 방식은 관리자 ID만 보호하고 다른 사용자의 데이터 노출을 막지 못함.
*   **교정 패치**: `if str(session_user_id) != str(target_id): return "Unauthorized"` 로직을 통해 요청자와 리소스 소유권이 일치할 때만 접근 허용.
*   **물리적 증명**: `{"status": "BLOCKED", "reason": "Unauthorized: Ownership mismatch"}` 응답 확인.

---

### 3. 결론
블루팀은 단순 필터링의 한계를 인지하고, **패턴 기반의 정밀 차단(정규식)**과 **아키텍처 레벨의 권한 검증(세션)**을 통해 보안 수준을 획기적으로 높였습니다. 모든 재검증 결과는 로컬 테스트베드에서의 **실제 프로세스 반환값**을 통해 입증되었습니다.
