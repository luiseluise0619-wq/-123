# 외부 API 연결

키는 브라우저·소스·GitHub에 넣지 않고 VPS의 `/etc/mysbizon-node.env`에만 저장합니다. `deploy/configure-integrations.sh`를 `sudo`로 실행하면 입력값을 화면에 보이지 않게 받고 Node 서비스를 재시작합니다.

|기능|환경변수|추가 조건|
|---|---|---|
|서울 열린데이터광장|`SEOUL_API_KEY`|매출·점포·인구 등 코드의 고정 목록에서만 호출|
|공공데이터포털 상가정보|`DATA_GO_KR_KEY`|상가(상권)정보 API 활용신청 필요|
|K-Startup 공고|`DATA_GO_KR_KEY` 또는 `KSTARTUP_API_KEY`|K-Startup 조회서비스 활용신청 필요. 별도 키가 없으면 공공데이터 키 사용|
|R-ONE|`RONE_API_KEY`|소규모·중대형·집합상가의 임대료·공실률·임대가격지수 공식 코드가 서버에 고정되어 있어 키만 필요|
|한국수출입은행 환율|`EXIM_API_KEY`|2026년 신규 `oapi.koreaexim.go.kr` 주소 사용|
|Gemini|`GEMINI_API_KEY`|기본 모델 `gemini-3.8-flash`; 키는 헤더로만 전송|

`GET /api/integrations`는 연결 여부만 보여 주고 키 값은 반환하지 않습니다. `POST /api/public-data`는 정해진 기관·데이터만 조회하며 사용자가 외부 URL을 지정할 수 없습니다. `POST /api/gemini`는 이메일·전화번호·주민번호 모양의 입력을 거부하고 `store:false`로 호출합니다.

`data.go.kr`은 하나의 통합 데이터 API가 아닙니다. 같은 서비스키를 쓰더라도 상가정보, 주차장, K-Startup 등 필요한 API를 각각 활용신청해야 합니다. R-ONE은 공개 요청이 임의의 통계표를 지정하지 못하도록 지원할 상가 유형과 지표의 공식 코드를 서버 허용 목록에 고정했습니다. 기본 지역은 서울이며, 조회 요청에서 검증된 6자리 R-ONE 지역·상권 코드를 선택할 수 있습니다.

서울 공식 API는 현재 문서상 `http://openapi.seoul.go.kr:8088` 형식입니다. 서버에서만 호출하고 서울 전용 저권한 키를 사용합니다. 대량 데이터는 실시간 요청보다 기존 Python 수집기로 주기적으로 갱신하는 방식이 호출 한도와 화면 속도에 더 적합합니다.
