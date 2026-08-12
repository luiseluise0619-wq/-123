# 웹 취약점 자율 대항 보고서 v2 (Web Autonomous Arena v2)

본 보고서는 무작위로 생성된 웹 취약점 시나리오에 대해 레드팀의 공격과 블루팀의 패치를 실제 인메모리 SQLite DB 환경에서 실행하여 얻은 물리적 검증 결과만을 기록합니다. 특히 블루팀의 의도적 불완전 패치로 인한 **BLUE_LOSS** 사례를 포함합니다.

---

### 1. 웹 자율 대항 실행 결과 (Physical Web Duel)

| 판 | 취약점클래스 | 공격결과 (RED) | 패치결과 (BLUE) | 판정 | 비고 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | sql_injection | SUCCESS | BLOCKED | **BLUE_WIN** | 파라미터 바인딩 적용 |
| 2 | sql_injection | SUCCESS | BLOCKED | **BLUE_WIN** | 파라미터 바인딩 적용 |
| 3 | idor | SUCCESS | **SUCCESS** | **BLUE_LOSS** | 블랙리스트 방식의 한계 (user2 노출) |
| 4 | sql_injection | SUCCESS | SUCCESS | **INVALID** | 불완전 패치 (공백 제거 우회 성공) |
| 5 | sql_injection | SUCCESS | SUCCESS | **INVALID** | 불완전 패치 (공백 제거 우회 성공) |

---

### 2. BLUE_LOSS 및 실패 사례 분석

#### [판 3: IDOR (의도적 실패)]
*   **취약점**: 권한 확인 없이 ID만으로 타인의 비밀 데이터 조회 가능.
*   **불완전 패치**: `if target_id == 1: return 'Access Denied'` (관리자 ID만 차단).
*   **레드팀 우회**: `target_id = 2` 주입하여 일반 사용자(user2)의 비밀 데이터 유출 성공.
*   **물리적 증명**: `BLUE_LOSS` (데이터 유출 확인).

#### [판 4, 5: SQL Injection (우회 성공)]
*   **취약점**: UNION 기반 데이터 유출.
*   **불완전 패치**: `replace(' ', '')` (공백 문자만 제거).
*   **레드팀 우회**: `/**/` (주석 처리)를 공백 대신 사용하여 필터링 우회 및 UNION 쿼리 실행 성공.
*   **물리적 증명**: `INVALID` (패치가 공격을 전혀 제어하지 못함).

---

### 3. 결론
실제 실행 기반 검증 결과, 블루팀의 **블랙리스트 기반 방어나 단순 문자열 필터링**은 레드팀의 진화된 우회 페이로드에 쉽게 무력화됨을 확인하였습니다. 모든 판정은 지어낸 서사 없이 **실제 DB 쿼리 결과와 반환값**을 바탕으로 물리적으로 도출되었습니다.
