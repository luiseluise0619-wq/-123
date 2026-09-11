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

// 본전 계산의 기본 가정. **한 곳에만** 둔다 —
// 처음 state 와 calc()·size() 의 폴백이 따로 적혀 있어서, 칸을 비우면
// 임대료가 400 이 아니라 0, 원가율이 35% 가 아니라 30% 로 계산됐다.
globalThis.MysbizonConst.BEP_DEFAULT={ rent:400, cogs:35, area:15 };

// 공통 근거 행: 좋음·주의·정보(판단 없음)의 화살표 스타일.
globalThis.MysbizonConst.TREND_STYLES = Object.freeze({
  arrowUp:'flex:none;font-size:15px;font-weight:600;color:var(--good);width:14px',
  arrowDn:'flex:none;font-size:15px;font-weight:600;color:var(--warn);width:14px',
  arrowInfo:'flex:none;font-size:15px;font-weight:600;color:var(--ink3);width:14px',
});
