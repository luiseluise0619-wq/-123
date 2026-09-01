// index.html 의 Component 에 섞어 넣는 '주제별 패널' 묶음.
//
// 무엇이 들어 있나
//   topicDefs()   화면에 띄울 주제 10개의 정의(제목·설명·출처·표시 조건)
//   buildTopic()  주제 하나를 열었을 때 들어갈 문단·막대·히트맵을 실제로 만드는 곳
//   bars() heatCells() stackComp()   buildTopic 이 쓰는 그리기 도우미
//   rank()        자치구 순위 (buildTopic 과 renderVals 양쪽에서 쓴다)
//
// 왜 밖으로 뺐나
//   buildTopic 하나가 220줄이다. index.html 안에 두면 지도·손익 계산 코드가
//   이 덩어리에 밀려 안 보인다. 주제를 하나 더 붙이거나 문구를 고칠 때
//   이 파일만 열면 되게 했다.
//
// 어떻게 붙나 — index_docs.js 와 같다(index.html 이 prototype 을 복사해 간다).
(function (g) {
  "use strict";
  class Topics {
  rank(name, getter, desc) {
    const core = this.core; if (!core) return { rank: 0, n: 0 };
    const arr = Object.keys(core.gu).map(n => [n, getter(n, core.gu[n])]).sort((a, b) => desc ? b[1] - a[1] : a[1] - b[1]);
    return { rank: arr.findIndex(x => x[0] === name) + 1, n: arr.length };
  }

  topicDefs() {
    return [
      { id: 'bench', title: '전국 자영업 벤치마크', desc: '생존율·창업비용·영업이익. 내 가게를 대볼 기준선', src: '통계청', on: () => true },
      { id: 'closure', title: '폐업과 폐업 사유', desc: '자치구별 폐업 규모와 문을 닫는 이유', src: '국세청', on: () => true },
      { id: 'rent', title: '임대료와 공실', desc: '상권별 임대료, 그리고 위험 신호인 공실률', src: '한국부동산원', on: () => true },
      { id: 'consumer', title: '유동인구', desc: '자치구·연령·성별 체류인구 분포', src: '서울 생활인구', on: () => !!this.pop },
      { id: 'repop', title: '거주 인구', desc: '동네 주민의 연령·성별 구성', src: '서울 상주인구', on: () => !!this.repop },
      { id: 'work', title: '직장 인구', desc: '출근하는 사람들. 점심과 퇴근 수요', src: '서울 직장인구', on: () => !!(this.work && this.work.available) },
      { id: 'income', title: '소득과 소비', desc: '소비자들이 어디에 돈을 쓰는지 — 지출 구성비', src: '서울 소득소비', on: () => !!(this.income && this.income.available && this.income.spend && this.income.spend.length) },
      { id: 'sales', title: '소비 패턴과 매출', desc: '업종별 시간대·요일·연령 매출과 객단가', src: '서울 추정매출', on: () => !!this.sales },
      { id: 'stores', title: '업종 위험도와 경쟁', desc: '업종별 폐업률, 점포 수, 프랜차이즈 비중', src: '서울 점포', on: () => !!this.stores },
      { id: 'forecast', title: '매출 예측이 가능한 업종', desc: '관성을 이기는 업종만. 나머지는 손익분기로 판단', src: '백테스트', on: () => !!this.forecast }
    ];
  }

  heatCells(labels, vals, fmt) {
    const mx = Math.max(...vals), mn = Math.min(...vals);
    return labels.map((l, i) => {
      const t = (vals[i] - mn) / ((mx - mn) || 1);
      return {
        label: l, value: fmt(vals[i]),
        style: 'height:44px;border-radius:4px;background:' + this.rampColor(t * 0.85 + 0.05) + ';display:flex;align-items:center;justify-content:center;font-size:11px;font-variant-numeric:tabular-nums;transition:background .4s ease;animation:riseIn .5s cubic-bezier(.2,.7,.3,1) both;animation-delay:' + (i * 55) + 'ms;color:' + (t > 0.62 ? 'var(--bg)' : 'var(--ink2)')
      };
    });
  }

  bars(rows, fmt, color) {
    const max = Math.max(...rows.map(r => r[1])) || 1;
    return rows.map((r, i) => ({
      label: r[0], value: fmt(r[1]),
      fill: 'display:block;height:100%;border-radius:3px;background:' + (color || 'var(--ink)') + ';width:' + (Math.max(0, r[1]) / max * 100).toFixed(1) + '%;transition:width .5s cubic-bezier(.4,0,.2,1);transform-origin:left;animation:growX .55s cubic-bezier(.2,.7,.3,1) both;animation-delay:' + (i * 45) + 'ms'
    }));
  }

  // 100% 누적 구성 막대 블록 생성. items=[{name,pct}] → 상위 7개는 고유색, 나머지는 '기타'(회색)로 합침.
  // 팔레트는 dataviz 스킬 검증 통과(색약 안전). 각 조각은 직접 % 라벨을 달아 대비 경고를 해소.
  stackComp(items) {
    const PAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];  // 검증된 카테고리 색
    const OTHER = '#8A8F98';   // '기타' 중립 회색(순위가 아니라 '나머지'라는 뜻)
    const named = items.filter(x => x.name !== '기타').slice().sort((a, b) => b.pct - a.pct);
    const etc0 = items.filter(x => x.name === '기타').reduce((s, x) => s + x.pct, 0);   // 데이터에 이미 있는 '기타'
    const head = named.slice(0, PAL.length);
    const tailPct = named.slice(PAL.length).reduce((s, x) => s + x.pct, 0);
    const segsData = head.map((x, i) => ({ name: x.name, pct: x.pct, color: PAL[i] }));
    const otherPct = Math.round((etc0 + tailPct) * 10) / 10;
    if (otherPct > 0) segsData.push({ name: '기타', pct: otherPct, color: OTHER });
    const fmt = v => (Math.round(v * 10) / 10).toFixed(1) + '%';
    const last = segsData.length - 1;
    const segs = segsData.map((s, i) => ({
      title: s.name + ' ' + fmt(s.pct),
      // 세그먼트 폭=구성비%. 마지막 조각 빼고 오른쪽에 2px 배경색 간격(조각 경계 분리 — dataviz 규칙).
      style: 'flex:0 0 ' + s.pct + '%;background:' + s.color + ';height:100%;' + (i === last ? '' : 'box-shadow:inset -2px 0 0 var(--bg);') +
        'animation:growX .6s cubic-bezier(.2,.7,.3,1) both;transform-origin:left;animation-delay:' + (i * 55) + 'ms'
    }));
    const legend = segsData.map(s => ({
      name: s.name, value: fmt(s.pct),
      dot: 'width:10px;height:10px;border-radius:3px;background:' + s.color + ';display:inline-block;flex:none'
    }));
    return { isStack: true, segs, legend };
  }

  buildTopic(id) {
    const B = [];
    const H = t => B.push({ isHead: true, text: t });
    const T = t => B.push({ isText: true, text: t });
    const N = t => B.push({ isNote: true, text: t });
    const BAR = (rows, fmt, color) => B.push({ isBars: true, rows: this.bars(rows, fmt, color) });
    // 100% 누적 구성 막대(부분-전체). items=[{name,pct}] → 상위 7개 + 기타(회색). dataviz 검증 팔레트.
    const STACK = (items) => B.push(this.stackComp(items));
    const core = this.core;
    let title = '', lede = '', source = '';

    if (id === 'bench') {
      // core.bench 는 통계청 전국 자영업 [실측] 벤치마크. 아래 { } 객체는 core 로딩 실패 시에만 쓰는 [폴백]
      // 근사값(전국 평균 영업이익 258만·창업비 8500만 등) — 정상 로딩 시엔 도달하지 않는다.
      const b = (core && core.bench) || { profit_month: 258, revenue_month: 1950, startup: 8500, survival1: 64.4 };
      title = '전국 자영업 벤치마크'; lede = '내 가게가 잘 되고 있는지는 혼자서는 알 수 없습니다. 전국 평균이 기준선입니다.';
      H('평균적인 가게는 월 ' + this.won(b.revenue_month) + '을 팝니다.');
      T('영업이익은 월 ' + this.won(b.profit_month) + ' 수준입니다. 매출의 13% 정도가 손에 남는다는 뜻입니다.');
      H('열 곳 중 여섯 곳이 1년을 넘깁니다.');
      BAR([['1년 생존', b.survival1], ['1년 내 폐업', 100 - b.survival1]], v => v.toFixed(1) + '%');
      T('평균 창업비용은 ' + this.won(b.startup) + '입니다. 회수 기간을 계산할 때 이 값을 출발점으로 씁니다.');
      source = '통계청 소상공인실태조사 · 기업생멸행정통계';
    }

    if (id === 'closure') {
      title = '폐업과 폐업 사유'; lede = '2024년 서울에서 ' + this.num((core && core.seoul_close) || 0) + '개 사업자가 문을 닫았습니다.';
      H('폐업은 대부분 한 가지 이유로 일어납니다.');
      const reasons = (core && core.reasons) || {};
      BAR(Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 6), v => this.num(v) + '건');
      T('사업부진이 절반입니다. 입지와 수요를 먼저 확인해야 하는 이유입니다.');
      H('자치구별로는 규모보다 추세가 중요합니다.');
      const tr = Object.entries(core ? core.gu : {}).map(([n, g]) => [n, g.trend]).sort((a, b) => b[1] - a[1]).slice(0, 10);
      BAR(tr, v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%', 'var(--bad)');
      N('폐업 건수는 상권 규모에 좌우되므로 지역 간 우열 비교에 쓰지 않습니다. 증감률만 비교합니다.');
      source = '국세청 폐업통계 (2022–2024)';
    }

    if (id === 'rent') {
      title = '임대료와 공실'; lede = '고정비 중 유일하게 계약 전에 정해지는 값입니다.';
      const zones = Object.entries((core && core.rentZones) || {}).filter(([k, v]) => k !== '서울' && v.rent);
      H('서울 평균은 ㎡당 ' + ((core && core.rentSeoul.rent) || 5.3) + '만원입니다.');
      T('공실률은 ' + ((core && core.rentSeoul.vacancy) || 6.4) + '%입니다. 공실이 높다는 것은 그 자리에서 버티지 못한 가게가 많았다는 뜻입니다.');
      H('임대료가 가장 높은 상권');
      BAR(zones.slice().sort((a, b) => b[1].rent - a[1].rent).slice(0, 8).map(([k, v]) => [k.replace('서울·', ''), v.rent]), v => v.toFixed(1) + '만원/㎡');
      H('공실률이 가장 높은 상권');
      BAR(zones.slice().sort((a, b) => b[1].vacancy - a[1].vacancy).slice(0, 8).map(([k, v]) => [k.replace('서울·', ''), v.vacancy]), v => v.toFixed(1) + '%', 'var(--bad)');
      N('임대료는 자치구가 아니라 상권 단위로 공표됩니다. 자치구 지도에 임대료 레이어가 없는 이유입니다.');
      source = '한국부동산원 상업용부동산 임대동향 (중대형 상가)';
    }

    if (id === 'consumer') {
      const P = this.pop;
      title = '유동인구'; lede = '이곳에는 사람이 얼마나 머무는가.';
      if (!P) { B.push({ isEmpty: true, text: '생활인구 데이터를 불러오지 못했습니다.', sub: '' }); }
      else {
        const rows = Object.entries(P.gu).map(([n, d]) => [n, d.tot]).sort((a, b) => b[1] - a[1]).slice(0, 10);
        H('오후 2시, 서울에 머무는 사람');
        BAR(rows, v => this.num(v) + '명');
        H('연령대로 보면 차이가 더 분명해집니다.');
        const cur = P.gu[this.state.gu] || P.gu['강남구'];
        BAR([['10대', cur.a10], ['20대', cur.a20], ['30대', cur.a30], ['40대', cur.a40], ['50대', cur.a50], ['60대+', cur.a60]], v => this.num(v) + '명');
        T(this.state.gu + ' 기준입니다. 지도에서 지역을 바꾸면 이 분포도 바뀝니다.');
        N('체류인구는 거주자와 방문자를 합한 값입니다. 소비력과 직접 비례하지는 않습니다.');
        source = '서울 열린데이터광장 생활인구 · ' + P.stdr_date + ' ' + P.hour + '시';
      }
    }

    if (id === 'repop') {
      const R = this.repop;
      title = '거주 인구'; lede = '배후 수요의 성격을 정하는 값입니다.';
      if (!R) B.push({ isEmpty: true, text: '상주인구 데이터가 아직 적재되지 않았습니다.', sub: '' });
      else {
        const Rsum = R.age.reduce((a, b) => a + b, 0) || 1;
        const Rp = R.age_pct || R.age.map(v => Math.round(v / Rsum * 1000) / 10);
        H('배후 거주민 연령 구성 (상권 배후지 기준 · 비율)');
        BAR([['10대', Rp[0]], ['20대', Rp[1]], ['30대', Rp[2]], ['40대', Rp[3]], ['50대', Rp[4]], ['60대+', Rp[5]]], v => v + '%');
        T('60대 이상 비중이 가장 큽니다. 낮 시간대 수요를 겨냥한 업종이라면 이 분포가 유동인구보다 중요합니다. (상권 배후지 합산이라 절대 인구수가 아닌 구성비로 봅니다.)');
        source = '서울 상권분석서비스 상주인구 · ' + R.quarter + '분기';
      }
    }

    if (id === 'work') {
      const W = this.work;
      title = '직장 인구'; lede = '점심과 퇴근 시간의 수요는 여기서 나옵니다.';
      if (!W || !W.available) B.push({ isEmpty: true, text: '직장인구 데이터가 아직 적재되지 않았습니다.', sub: '' });
      else {
        const Wsum = W.age.reduce((a, b) => a + b, 0) || 1;
        const Wp = W.age_pct || W.age.map(v => Math.round(v / Wsum * 1000) / 10);
        const wml = W.ml_pct != null ? W.ml_pct : Math.round(W.m / (W.m + W.f) * 100);
        const wfml = W.fml_pct != null ? W.fml_pct : Math.round(W.f / (W.m + W.f) * 100);
        H('직장인구는 30–40대에 몰려 있습니다. (상권 배후지 기준 · 비율)');
        BAR([['10대', Wp[0]], ['20대', Wp[1]], ['30대', Wp[2]], ['40대', Wp[3]], ['50대', Wp[4]], ['60대+', Wp[5]]], v => v + '%');
        T('남성 ' + wml + '%, 여성 ' + wfml + '%입니다. (배후지 합산이라 구성비로 해석합니다.)');
        source = '서울 상권분석서비스 직장인구 · ' + W.quarter + '분기';
      }
    }

    if (id === 'income') {
      title = '소득과 소비'; lede = '선택한 자치구 소비자들이 어디에 돈을 쓰는지 봅니다.';
      const IC = this.income;   // income.json → { available, quarter, income_avg, spend:[{name,pct}], gu:{구:{quarter,spend}} }
      // 방어 가드: 특정 분기 카테고리 집계가 깨지면 한 항목(예: 여가·문화)이 소비 대부분을
      // 차지하는 이상치가 나온다. 생활 필수(식료품·음식·의료비·교통)가 40% 이상이고 단일 항목이
      // 50%를 넘지 않을 때만 '정상'으로 본다. 서버 수집기와 같은 기준(이중 안전장치).
      const spendOK = (arr) => {
        if (!arr || !arr.length) return false;
        const tot = arr.reduce((s, x) => s + x.pct, 0) || 1;
        const ess = arr.filter(x => ['식료품', '음식', '의료비', '교통'].includes(x.name)).reduce((s, x) => s + x.pct, 0);
        const mx = Math.max(...arr.map(x => x.pct));
        return ess / tot >= 0.40 && mx / tot <= 0.50;
      };
      // 선택 자치구가 정상이면 그것을, 아니면 서울 전체가 정상이면 그것을 쓴다.
      const guData = IC && IC.gu && IC.gu[this.state.gu];
      const guOK = guData && spendOK(guData.spend);
      const seoulOK = IC && spendOK(IC.spend);
      const spendArr = guOK ? guData.spend : (seoulOK ? IC.spend : null);
      const scope = guOK ? this.state.gu : '서울 전체';
      const qu = (guOK && guData.quarter) || (IC && IC.quarter);
      // 데이터가 없거나(available=false) 정상 소비 데이터가 하나도 없으면 빈 상태로.
      if (!IC || IC.available === false || !(spendArr && spendArr.length)) {
        // 데이터 자체가 없는 경우 vs 최신 분기 집계가 깨져 정상값이 없는 경우를 구분해 안내.
        const brokenButPresent = IC && IC.available !== false && (IC.spend || guData);
        B.push({
          isEmpty: true,
          text: brokenButPresent ? '소비 구성 데이터를 보정 중입니다.' : '소비 구성 데이터를 불러오지 못했습니다.',
          sub: brokenButPresent
            ? '최신 분기 카테고리 집계에 이상치가 있어 표시를 보류했습니다. 정상 분기 데이터로 다시 채워집니다.'
            : ((IC && IC.reason) ? IC.reason : '서울 상권분석서비스 소비 지표가 아직 공표되지 않았습니다. 공표되는 대로 이 화면에 반영됩니다.')
        });
        source = '서울 상권분석서비스 소비 (보정 중)';
      } else {
        // 소득 평균: 서울시가 '월 평균 소득 금액'을 2020년 수급 중단·2026-05-13 삭제해 더 이상 제공되지 않는다.
        // 있으면 표시하고, 없으면(현재) 왜 없는지 정직하게 안내한다 — 지어내지 않는다.
        if (IC.income_avg) {
          H('평균 월소득 ' + this.won(Math.round(IC.income_avg / 10000)));
          T('평균 소득의 단순 평균입니다. 지역마다 편차가 큽니다.');
        } else {
          N((IC.income_note) || '평균 소득 금액은 서울시가 2026년 5월 원본 데이터 수급 중단으로 제공을 종료해 표시하지 않습니다. 자치구별 소득이 필요하면 국세청·국민연금 통계가 대체 자료입니다.');
        }
        // 선택한 자치구가 깨져(또는 미제공) 서울 전체로 대체된 경우, 왜 바뀌었는지 알려준다.
        if (!guOK && this.state.gu) {
          N(this.state.gu + '는 최신 분기 소비 집계에 이상치가 있어 서울 전체 구성으로 대신 보여드립니다.');
        }
        // 소비 구성: 지출 카테고리 비율(%) — 절대금액은 자치구 규모차로 오해 소지 → 비율만 [실측].
        // 100% 누적 구성 막대로 부분-전체를 한눈에(도넛보다 10개 카테고리 비교에 정확).
        H(scope + ' 소비 지출은 어디로 가나 — 구성비');
        const spend = spendArr.slice().sort((a, b) => b.pct - a.pct);   // 큰 항목부터
        STACK(spend);
        const top = spend[0];
        T('지출이 가장 많은 항목은 ' + top.name + '(' + top.pct.toFixed(1) + '%)입니다. ' + scope + ' 소비자들의 지갑이 어디로 향하는지 보여줍니다.');
        N('지출 카테고리별 구성비입니다(합계 100%). 절대 금액은 자치구 규모가 달라 비율만 씁니다. 소비는 카드·통계 기반 추정입니다.');
        source = '서울 상권분석서비스 소비-자치구 · ' + (qu ? qu.slice(0, 4) + ' ' + qu.slice(4) + '분기' : '');
      }
    }

    if (id === 'sales') {
      const S = this.sales;
      title = '소비 패턴과 매출'; lede = '같은 업종이라도 언제 팔리는지가 다릅니다.';
      if (!S) B.push({ isEmpty: true, text: '추정매출 데이터를 불러오지 못했습니다.', sub: '' });
      else {
        const k = S.ind[this.state.ind] ? this.state.ind : Object.keys(S.ind)[0];
        const d = S.ind[k];
        H('하루 중 언제 팔리는가 — ' + k);
        const labels = ['00–06', '06–11', '11–14', '14–17', '17–21', '21–24'];
        const mx = Math.max(...d.tmzon);
        const pts = d.tmzon.map((v, i) => [i * (640 / 5), 170 - v / mx * 150]);
        B.push({
          isLine: true, path: pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''),
          dots: pts.map((p, i) => ({ x: p[0], y: p[1], label: d.tmzon[i].toFixed(1), lx: Math.min(620, Math.max(20, p[0])) })),
          yMax: mx.toFixed(0) + '%', yZero: '0%',
          ticks: labels.map((l, i) => ({ x: i * (640 / 5), label: l }))
        });
        T('시간대별 매출 비중(%)입니다. 인력과 재고를 어디에 둘지 정하는 근거입니다.');
        H('요일과 시간대를 나란히 봅니다.');
        B.push({
          isHeat: true, strips: [
            { label: '시간대', cells: this.heatCells(labels, d.tmzon, v => v.toFixed(1) + '%') },
            { label: '요일', cells: this.heatCells(['월', '화', '수', '목', '금', '토', '일'], d.dow, v => v.toFixed(1) + '%') }
          ]
        });
        N('요일과 시간대를 교차한 매출(예: 금요일 저녁)은 공개되지 않습니다. 각각의 비중만 따로 공표되므로 곱해서 추정하지 않습니다.');
        H('객단가(건당 결제액)는 ' + this.num(d.unit) + '원입니다.');
        N('카드 결제 1건 기준입니다. 여러 명이 한 번에 결제하면 1인 지출보다 큽니다(식당·카페·주점 특히). 현금 결제는 빠져 있습니다.');
        T('손익분기 매출을 이 값으로 나누면 하루에 필요한 결제 건수(팀 수)가 나옵니다. 머릿수(손님 수)와는 다릅니다.');
        source = '서울 상권분석서비스 추정매출 · ' + S.quarter + '분기';
      }
    }

    if (id === 'stores') {
      const S = this.stores;
      title = '업종 위험도와 경쟁'; lede = '어떤 업종은 다른 업종보다 확실히 더 자주 닫습니다.';
      if (!S) B.push({ isEmpty: true, text: '점포 데이터를 불러오지 못했습니다.', sub: '' });
      else {
        const big = Object.entries(S.ind).filter(([, v]) => v.stores > 2000);
        H('분기 폐업률이 높은 업종');
        BAR(big.map(([k, v]) => [k, v.close_rate]).sort((a, b) => b[1] - a[1]).slice(0, 10), v => v.toFixed(1) + '%', 'var(--bad)');
        H('점포 수가 많은 업종');
        BAR(big.map(([k, v]) => [k, v.stores]).sort((a, b) => b[1] - a[1]).slice(0, 8), v => this.num(v) + '곳');
        const cur = S.ind[this.state.ind];
        if (cur) T(this.state.ind + '은 서울에 ' + this.num(cur.stores) + '곳, 분기 폐업률 ' + cur.close_rate + '%, 프랜차이즈 비중 ' + cur.fr_share + '%입니다.');
        N('폐업률은 분기 기준이며, 점포 수가 적은 업종은 변동이 큽니다.');
        source = '서울 상권분석서비스 점포 · ' + S.quarter + '분기';
      }
    }

    if (id === 'forecast') {
      const F = this.forecast;
      title = '매출 예측이 가능한 업종'; lede = '예측이 의미 있으려면 "전분기와 같다"고 찍는 것보다 나아야 합니다.';
      if (!F) B.push({ isEmpty: true, text: '백테스트 결과를 불러오지 못했습니다.', sub: '' });
      else {
        const beat = Object.entries(F.ind).filter(([, v]) => v.beats_naive && v.mape <= 20);
        H(F.n_industries + '개 업종 중 ' + F.n_beat_naive + '개만 관성을 이겼습니다.');
        T('그중 실사용할 만한 정확도(오차 20% 이내)를 갖춘 업종은 ' + beat.length + '개입니다. 전부 계절성이 뚜렷한 업종입니다.');
        BAR(beat.slice(0, 8).map(([k, v]) => [k, v.mape]), v => '오차 ' + v.toFixed(1) + '%', 'var(--good)');
        H('나머지 업종은 예측하지 않습니다.');
        T('음식·카페·서비스업은 분기 매출이 안정적이라 어떤 모델도 관성을 이기지 못했습니다. 허위 예측선을 그리는 대신 손익분기 계산으로 판단합니다.');
        source = '자체 백테스트 · ' + F.quarters.length + '개 분기';
      }
    }

    return { title, lede, blocks: B, source };
  }
  }
  g.__IDX_TOPICS = Topics.prototype;
})(window);
