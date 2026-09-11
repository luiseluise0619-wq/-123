# 회사 계정으로 API 이전하기

2026-09-11 코드 조사 및 공식 안내 확인. 이 문서는 이전 대상과 절차 안내입니다. 개인/회사 계정 로그인, 키 발급·교체·폐기, 운영 배포는 실행하지 않았습니다. 실제 사용 중인 개인 계정의 계약·승인 목록은 저장소만으로 알 수 없습니다.

## 먼저 방문할 사이트

|우선순위|사이트·로그인/신청 경로|준비할 항목|코드에서의 역할·설정 위치|
|---|---|---|---|
|1|[서울 열린데이터광장 이용안내](https://data.seoul.go.kr/together/guide/useGuide.do) → 로그인 → 인증키 신청|회사 담당자가 관리할 인증키|매출·점포·생활인구·소득·시설 등 수집. GitHub Actions `SEOUL_API_KEY`|
|1|[공공데이터포털](https://www.data.go.kr/) → 로그인 → 대상 데이터 검색 → 활용신청|회사 관리 계정의 서비스키와 API별 승인/한도|상가정보·주차장·상업업무용 실거래·가맹정보 수집. GitHub Actions `DATA_GO_KR_KEY`; 지원사업을 연결하면 Node에도 필요|
|1, 이메일 운영 시|[Brevo API 키 안내](https://developers.brevo.com/docs/api-key-authentication) → 회사 계정 → SMTP & API → API keys|새 API key, 회사 발신 이메일·도메인|현재 Node 리포트 발송. Render/VPS의 `BREVO_API_KEY`, `REPORT_FROM_EMAIL`, `REPORT_FROM_NAME`|
|현재 수집 경로 확인|[지방행정인허가 데이터개방](https://www.localdata.go.kr/) → 운영 중인 제공/신청 경로 확인|인허가 데이터 인증 수단|`collect_openings.py`의 `LOCALDATA_KEY`, `LOCALDATA_BASE`. 이번 공식 사이트 조회는 timeout으로 최신 발급 경로/운영 상태를 검증하지 못함|
|추가 연동|[한국은행 ECOS Open API](https://ecos.bok.or.kr/api/) → 인증키 신청 안내|ECOS 인증키|미공개 `api/market.js`의 `ECOS_KEY`. 키만 넣어도 현재 화면에 연결되지는 않음|
|추가 연동|[KAMIS Open API](https://www.kamis.or.kr/customer/reference/openapi_list.do) → 사용신청|인증키 + 요청자 ID|미공개 `api/market.js`의 `KAMIS_KEY`, `KAMIS_ID`. 공공데이터포털을 통한 신청 경로도 공식 안내에 있음|
|추가 연동|[오피넷 Open API](https://www.opinet.co.kr/user/custapi/custApiInfo.do) → 인증키 발급|오피넷 인증키|미공개 `api/market.js`의 `OPINET_KEY`. 국내 석유제품 가격용; 국제유가까지 된다고 단정하지 않음|
|임대통계 자동화 검토|[한국부동산원 R-ONE Open API](https://www.reb.or.kr/r-one/portal/openapi/openApiIntroPage.do) → 로그인 → 인증키 발급내역/목록|필요 통계에 맞는 인증키 및 통계코드|현재 정적 임대료 자료를 더 안정적으로 갱신하기 위한 후보. Node에 완성된 직접 연동은 없음|

서울 인증키 발급은 공식 이용안내를, KAMIS의 인증키와 요청자 ID 조합은 [요청 변수 명세](https://www.kamis.or.kr/customer/reference/openapi_list.do?action=detail&boardno=1)를 기준으로 확인했습니다. ECOS 페이지는 서비스 주소만 확인됐고 본문이 추출되지 않아 현재 로그인·신청 화면의 세부 절차를 확정하지 않았습니다.

공공데이터포털에서는 이 저장소의 수집 기능에 맞춰 다음 데이터 이름을 찾아 기존 계정의 승인 내역과 대조하세요. 하나의 서비스키가 있다고 모든 API의 사용 승인이 자동으로 옮겨지는 것으로 가정하면 안 됩니다.

- 소상공인시장진흥공단 상가(상권)정보: 상가 위치·업종.
- 전국주차장정보 표준데이터: 접근성 자료.
- 국토교통부 상업업무용 부동산 매매 실거래가: `RTMSDataSvcNrgTrade` 수집 경로.
- 공정거래위원회 가맹사업/브랜드 정보: 브랜드·비용 API의 승인 및 endpoint를 개별 확인.
- 창업진흥원 K-Startup 사업공고: 지원사업 연결 후보. [기관 공식 API 조회 화면](https://nidview.k-startup.go.kr/view/public/kisedKstartupService/contentInformation)에서 제공 항목을 확인할 수 있습니다.

현재 `api/support.js`는 `SUPPORT_API_URL`을 외부 설정으로 받는 범용 파서입니다. 특정 K-Startup API에 완전히 맞춰 검증된 상태가 아닙니다. 실제로 신청한 서비스의 JSON 파라미터, 페이지 수집, 제목·마감일·원문 링크 필드를 맞추고 샘플 응답 테스트를 한 뒤 연결해야 합니다. `DATA_GO_KR_KEY`와 URL만 입력하면 모든 지원사업이 완성되는 것은 아닙니다.

## 지금 운영에는 필요하지 않은 계정

|사이트|필요해지는 경우|현재 코드|
|---|---|---|
|[Naver Developers](https://developers.naver.com/docs/common/openapiguide/appregister.md)|검색 트렌드 기능을 실제 연결할 때|Python 실험 코드의 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`; Node 미사용|
|[Google AI Studio API 키](https://ai.google.dev/gemini-api/docs/api-key)|Gemini 상담 기능을 회사 Google Cloud 프로젝트에서 다시 검증할 때|Python의 `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY`; Node 미사용|
|[Kakao Developers](https://developers.kakao.com/docs/ko/kakaomap/common)|지도·주소 검색을 새로 구현할 때|현재 안내문에 카카오가 언급되지만 운영 Node에서 호출하는 카카오 키 경로는 확인되지 않음|

네이버는 회사/단체라면 단체 회원 사용을 공식적으로 권장합니다. Google API 키는 Cloud 프로젝트에 연결되므로 회사 이메일로 로그인하는 것 외에 프로젝트 권한과 결제 주체를 함께 확인해야 합니다. [Google 프로젝트·결제 설명](https://ai.google.dev/gemini-api/docs/billing/)에 따라 관리하세요. Gemini를 재활성화할 때는 저장소의 오래된 모델 지정과 현재 키 유형/SDK 지원도 별도로 점검해야 합니다.

## 같은 키인데 이름이 다른 곳

|원천|주로 쓰는 이름|다른 코드의 이름|이전할 때 주의|
|---|---|---|---|
|서울|`SEOUL_API_KEY`|`SEOUL_OPENDATA_API_KEY`|workflow가 일부 Python 단계에 같은 secret을 두 이름으로 전달함|
|공공데이터포털|`DATA_GO_KR_KEY`|`DATA_GO_KR_API_KEY`, `SERVICE_KEY`|Node와 수집기, Python 실험 설정을 구분함|
|KAMIS|`KAMIS_KEY`, `KAMIS_ID`|`KAMIS_CERT_KEY`, `KAMIS_CERT_ID`|Node 미공개 코드와 Python 실험 코드의 변수명이 다름|
|Gemini|`GEMINI_API_KEY`|`GOOGLE_API_KEY`|현재 Node 운영과 무관함|

서로 다른 기관의 키는 호환되지 않습니다. 소스의 `DATA_GO_KR_KEY or REB_API_KEY` 같은 fallback 이름만 보고 두 인증 체계를 같은 것으로 처리하면 안 됩니다. 선택한 endpoint의 인증 명세를 기준으로 매핑해야 합니다.

## 이전 순서

1. 회사가 관리할 로그인, 복구 수단, 담당자와 예비 관리자를 정합니다. 조직 기능이 있는 서비스는 회사 조직/프로젝트를 사용하고, 개인 실명 인증이 필요한 서비스는 해당 정책에 맞는 회사 담당자 체계를 확인합니다.
2. 기존 API별 승인 목록·서비스 이름·endpoint·한도·만료일을 기록합니다. 키 값 자체는 문서/저장소/채팅에 넣지 않습니다.
3. 회사 관리 계정/앱에서 키를 발급하고 필요한 API를 신청합니다. 회사 소유권 이전 기능이 있다면 기존 앱 이전과 새 앱 발급 중 적절한 방식을 선택합니다.
4. staging용 secret을 먼저 교체합니다. 읽기 전용 수집 응답과 schema·분기·단위·행 수를 검사하고, 실패한 수집이 기존 정상 파일을 덮어쓰지 않는지 확인합니다.
5. Brevo는 회사 발신자와 도메인 인증을 완료합니다. 실제 DNS 레코드는 계정 화면에서 제공한 값을 사용합니다. [Brevo 발신자·도메인 안내](https://developers.brevo.com/docs/getting-started-with-senders-and-domains).
6. 검증 후 운영 secret 교체: 수집용은 GitHub 저장소/Environment secrets, 요청 시 필요한 Node 키는 Render Environment 또는 VPS `/etc/mysbizon.env`. 브라우저/정적 JSON에는 넣지 않습니다.
7. 실제 health·지원사업 조회·승인된 테스트 수신자 메일로 결과를 확인합니다. 짧은 되돌리기 기간 뒤 사용 중인 작업이 없음을 확인하고 개인 키를 폐기합니다.
8. GitHub 저장소 소유권/배포 연결, Render workspace, Cafe24 계약·서버 관리자, 회사 도메인/DNS도 함께 대조합니다. API 키만 바꾸어도 인프라 소유권이 자동으로 이전되지는 않습니다.

이번에는 실제 계정에 들어가거나 키를 교체하지 않았습니다. 현재 서비스의 Node 기본 구동에는 외부 API 키가 필요하지 않고, 수집 갱신·지원사업·메일 등 각 기능을 켤 때 해당 인증이 필요합니다.

## 추가할 데이터 우선순위

|순위|추가·연결할 데이터|사용자에게 생기는 기능|진행 방법|
|---|---|---|---|
|1|구 × 업종 × 분기 매출·점포 이력|통합시세에서 구와 업종을 함께 고르고 추이 비교|기존 서울 API 수집 결과를 구별로 재집계. 현재 sales_history는 서울 전체 합계라 구별 과거값을 지어내지 말 것|
|2|최근 개업·폐업/경쟁 점포 변화|‘근처에 같은 업종이 얼마나 생겼나’|기존 인허가 수집기 정상화와 제공 경로 확인, 좌표·폐업일·중복 처리|
|3|지원사업 원문·마감·대상 조건|설문 응답에 대한 즉각적 가치 제공|공식 K-Startup 등 실제 선택 API에 맞춘 지원사업 adapter 구현|
|4|임대료·공실 통계 갱신 및 범위 정보|시세 기준일·조사구획을 명확히 비교|R-ONE 제공 목록 확인 후 현재 데이터와 단위·표본 범위 매칭|
|5|업종과 관련된 식재료 가격|카페/음식점 사용자의 원가 변화 이해|KAMIS에서 관련 품목·도소매·지역·규격을 일관되게 선택|
|6|금리·환율|대출/수입재료 시나리오에 필요한 기준|ECOS 연결 후 시나리오 입력에 명확히 사용; 원가·상환액을 임의 변경하지 않음|

위 순위는 현재 서비스 기능과 데이터 빈틈에 근거한 제안입니다. 특히 구별 과거 이력은 새 기관부터 늘리는 것보다 기존 수집 파이프라인을 보완하는 편이 우선입니다. KAMIS·ECOS·R-ONE은 위 공식 사이트의 제공 범위에 맞춰 후보를 정했으며, 회사 계정에서의 실제 이용 승인·호출 가능 여부까지 확인한 것은 아닙니다.

개별 점포 실제 매출·계약 월세·보증금·권리금은 이 공개 API 목록으로 전부 얻을 수 없습니다. 동의받은 자기보고나 별도 제휴 자료를 원천·관측 시점·가정값 여부와 함께 분리해 쌓아야 합니다. 검색량/유동인구를 실제 고객 수나 매출로 바꾸어 표시하지 않습니다.
