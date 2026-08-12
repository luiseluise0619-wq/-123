# AegisAI 로컬 보안 감사 API

이 API는 **제출된 Python 코드를 실행하지 않는 정적 분석 인터페이스**입니다. 내부의 Bandit 기반 탐지기와 프로젝트의 결정적 패치 규칙을 사용하며, 패치가 적용된 경우에는 결과 코드를 다시 스캔해 해결 여부를 검증합니다. 스캐너가 탐지하지 않은 문제가 없다는 보장은 하지 않으며, 결정적으로 수정할 수 없는 항목은 자동 수정 성공으로 표기하지 않습니다.

> 이 구현은 로컬 개발용입니다. `X-Org-Id`, `X-User-Email`, `X-User-Role` 헤더는 호출자가 제공하는 값이므로, 공개 배포 전에는 검증된 OIDC·세션·API 키 기반 인증으로 교체해야 합니다.

| 항목 | 현재 동작 |
| --- | --- |
| 분석 대상 | 인라인 Python 소스 코드, 최대 200,000바이트 |
| 코드 실행 | 수행하지 않음 |
| 소스 보존 | 수행하지 않음. 메모리 보고서에는 원본·패치 코드가 저장되지 않음 |
| 탐지 | Bandit 정적 분석 및 선택적으로 학습된 모델의 확률 |
| 자동 패치 | 알려진 결정적 규칙만 적용한 뒤 재스캔으로 검증 |
| 저장소 URL 감사 | 구현하지 않음. `/api/v1/audit`는 `501`을 반환하며 감사를 수행하지 않음 |

## 실행

```bash
cd -123
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

`bandit` 실행 파일이 서버 경로에 있어야 합니다. 설치되지 않은 경우 감사 API는 `503 Service Unavailable`을 반환합니다.

## 인라인 코드 감사

다음 요청은 실제 스캔 결과를 반환합니다. `apply_safe_fixes`를 `true`로 지정하면 허용된 결정적 수정만 적용하고, 수정된 코드를 다시 스캔하여 검증 결과를 포함합니다.

```bash
curl -X POST http://127.0.0.1:8000/api/v1/audit-code \
  -H 'Content-Type: application/json' \
  -H 'X-Org-Id: acme-security' \
  -H 'X-User-Email: lead@acme.example' \
  -H 'X-User-Role: Security Lead' \
  -d '{
    "source_code": "import hashlib\\nimport subprocess\\n\\ndef digest(data):\\n    return hashlib.md5(data).hexdigest()\\n\\ndef run(command):\\n    return subprocess.call(command, shell=True)\\n",
    "apply_safe_fixes": true
  }'
```

응답의 `audit.findings`는 실제 탐지 결과이며, `fix_verified_by_rescan`이 `true`일 때에만 적용된 패치가 재스캔에서 검증되었음을 의미합니다. `source_persisted`는 항상 `false`입니다.

## 조회 API

| 경로 | 설명 |
| --- | --- |
| `GET /health` | 서비스 상태를 반환합니다. |
| `GET /api/v1/audits/{audit_id}` | 같은 조직에서 요청한 감사 보고서를 조회합니다. 보고서에는 원본·패치 코드를 저장하지 않습니다. |
| `GET /api/v1/findings?severity=HIGH` | 같은 조직에서 생성된 실제 탐지 결과를 반환합니다. |
| `GET /api/v1/reports` | 현재 프로세스 수명 동안 생성된 보고서 요약을 반환합니다. |
| `GET /api/v1/audit-logs` | Admin 또는 Security Lead만 같은 조직의 로컬 감사 로그를 조회할 수 있습니다. |

보고서와 로그는 현재 메모리에만 존재하므로 서버를 재시작하면 사라집니다. 이는 원본 소스를 영속 저장하지 않기 위한 의도된 제약입니다.
