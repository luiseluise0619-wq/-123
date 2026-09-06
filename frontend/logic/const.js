'use strict';
// 여러 파일이 함께 쓰는 목록. 한 곳에만 둔다.
globalThis.MysbizonConst = globalThis.MysbizonConst || {};
// 시세분석 차트 목록. when 은 '이 차트를 언제 보면 좋은지' 배지.
// 한 곳에만 두고 화면과 데이터가 같은 목록을 쓰게 한다.
globalThis.MysbizonConst.PRICE_CATS=[
  {k:'rent', label:'상가 임대료', when:'자리 고를 때'},
  {k:'vacancy', label:'빈 상가 비율', when:'위험 볼 때'},
  {k:'sales', label:'장사별 매출 추이', when:'업종 고를 때'},
  {k:'spend', label:'자치구 소비 구성', when:'손님 볼 때'},
  {k:'churn', label:'문 열고 닫는 수', when:'타이밍 볼 때'},
  {k:'fr', label:'프랜차이즈 비중', when:'브랜드 정할 때'}
];
