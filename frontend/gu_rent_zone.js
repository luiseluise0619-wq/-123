// 자치구 → 한국부동산원 조사 '상권' 매핑 (공용 1벌).
//
// 왜 매핑이 필요한가
//   임대료·공실률은 자치구 단위로 공표되지 않는다. 부동산원은 '상권' 단위로만 조사한다.
//   그래서 각 자치구의 대표 상권 하나를 **명시적으로 골라** 쓰고,
//   어떤 상권 값을 빌려 썼는지 화면에 그대로 표기한다(추정을 실측처럼 보이지 않게).
//
// 왜 파일로 뺐나
//   index.html / mvp.html 에 같은 표가 복붙돼 있었다. 한쪽만 고치면 두 화면의 임대료가
//   달라진다(조용히 틀리는 종류의 버그다). 여기 한 곳만 고치면 전부 따라온다.
//
// 쓰는 법 (평범한 <script> 로 먼저 읽어두면 전역에 붙는다)
//   <script src="gu_rent_zone.js"></script>
//   var z = window.guRentZone('마포구', core);   // core = __SANGGWON.core
//   // → { rent, vacancy, zone:'홍대/합정', fallback:false }
//   //   fallback:true 면 그 구의 상권 값이 없어 서울 평균으로 대체했다는 뜻.
(function (g) {
  var MAP = {
    '종로구': '서울·종로', '중구': '서울·명동', '용산구': '서울·이태원', '성동구': '서울·왕십리',
    '광진구': '서울·건대입구', '동대문구': '서울·청량리', '중랑구': '서울·상봉역', '성북구': '서울·성신여대',
    '강북구': '서울·수유', '노원구': '서울·상계역', '은평구': '서울·연신내', '서대문구': '서울·신촌/이대',
    '마포구': '서울·홍대/합정', '양천구': '서울·목동', '강서구': '서울·화곡', '구로구': '서울·오류동역',
    '금천구': '서울·독산/시흥', '영등포구': '서울·영등포역', '동작구': '서울·노량진', '관악구': '서울·신림역',
    '서초구': '서울·교대역', '강남구': '서울·강남대로', '송파구': '서울·잠실/송파', '강동구': '서울·천호'
  };
  g.__GU_RENT_ZONE = MAP;
  g.guRentZone = function (gu, core) {
    if (!core || !core.rentZones) return null;
    var key = MAP[gu], z = key && core.rentZones[key];
    if (!z) {
      var s = core.rentSeoul || {};
      return { rent: s.rent, vacancy: s.vacancy, zone: '서울 평균', fallback: true };
    }
    return { rent: z.rent, vacancy: z.vacancy, zone: key.replace('서울·', ''), fallback: false };
  };
})(window);
