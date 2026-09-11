# 검증 결과 — 2026-09-11

Windows / Node 24.19.0. 상세 결과는 AUDIT.md의 8절과 함께 전달한 audit/ 증거를 참고하세요.

- 원본 npm test: 38 passed / 0 failed.
- 최종 npm test: 50 passed / 0 failed.
- npm run check:html, npm run check:data, npm run check:sums: 성공.
- 57개 JS/MJS node --check, backend Python compileall: 성공.
- 초기 단계 868 view models 일치. 후속 UX 변경 후 최종 62업종 ranking 및 report payload 일치.
- 54개 data/vendor 파일과 backend Python 원본 바이트 동일; CSS/locales는 승인된 UX 변경.
- 최소 runtime artifact 별도 실행/공개 API/정적 자원/제외 파일/덮어쓰기 거부 확인.
- 브라우저 검색·선택·차트·본전·리포트·인쇄용 표시 확인.

실 외부 이메일/지원사업 API, 모바일 전 기기, Render/Cafe24 배포, Linux systemd/Nginx/TLS, OS 인쇄/PDF 저장은 실행하지 않았습니다. Python syntax 검사는 외부 의존성을 사용하는 수집·ML 통합 검증이 아닙니다. 함수 handler를 제외한 view model 동등성은 모든 사용자 행동의 전수 검증이 아닙니다.
