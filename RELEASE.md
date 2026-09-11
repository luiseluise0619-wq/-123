# 2026-09-11 유지보수 릴리스

Node 운영 경로 유지, UI·데이터·계산식 유지, 책임 분리와 최소 배포 artifact 추가.

- app-logic의 요청/저장/리포트를 data/storage/report로 이동.
- screens의 홈 검색을 home, 시세를 기존 market으로 이동.
- views의 본전 계산 화면과 비교 화면을 diagnosis/comparison으로 이동.
- 기존 HTML 빌드의 Windows 진입점 버그 수정. 생성 HTML은 빌드로만 변경.
- API 동시 제한을 비동기 파일 조회보다 먼저 확보하도록 explicit handler map 사용.
- 지원 공고 upstream 오류/위험 URL 방어, fetch 호출자 취소 보존, 차트 종료 정리.
- static cold 요청의 read/gzip을 합치고 동시 새 파일 적재 상한 적용.
- deploy file allowlist와 manifest, Render artifact 시작, Cafe24 loopback 고정.
- 오래된 검증·설계 문서는 docs/history로 보관. 이전 REMOVED-FILES 목록은 현재 삭제 상태가 아님.

변경 근거와 검증 제한은 AUDIT.md, QA-RESULTS.md를 참고하세요. 운영 배포와 실제 메일 전송은 수행하지 않았습니다.
