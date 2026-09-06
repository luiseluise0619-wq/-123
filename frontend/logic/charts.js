'use strict';
// 차트 — Chart.js(vendor/chart.umd.js) 위에 이 서비스의 규칙을 얹는다.
//
// 규칙
//   · 축·단위·기준 기간을 반드시 적는다. 숫자만 떠 있으면 무슨 값인지 알 수 없다.
//   · hover 하면 값이 보인다(툴팁).
//   · 라이트/다크 테마를 따라간다 — CSS 변수를 실제로 읽어서 쓴다.
//   · 애니메이션은 짧게(250ms). 화면이 출렁이면 읽기 어렵다.
//   · 없는 데이터로 차트를 만들지 않는다. 만들 게 없으면 아예 안 그린다.
//
// 어떻게 붙나
//   화면(view model)이 spec 을 만들어 this._charts 에 담고,
//   마크업은 <canvas data-chart="아이디"> 만 둔다.
//   그리기는 componentDidUpdate → paintCharts() 가 한다.
//   DC 가 다시 그려도 같은 canvas 면 update, 사라졌으면 destroy 한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.charts = {

  // 지금 테마의 색을 실제로 읽어 온다(다크 모드에서 글자가 안 보이는 걸 막는다)
  chartTheme(){
    const cs = getComputedStyle(document.documentElement);
    const v = n => (cs.getPropertyValue(n) || '').trim();
    return {
      accent: v('--accent') || '#087F6B',
      accent2: v('--accent-2') || '#7FBCAE',
      accent3: v('--accent-3') || '#E8F5F1',
      ink: v('--ink') || '#191F28',
      ink2: v('--ink2') || '#4E5968',
      ink3: v('--ink3') || '#687583',
      line: v('--line') || '#EAECEC',
      bg: v('--bg') || '#FFFFFF',
      good: v('--good') || '#1F7A4D',
      warn: v('--warn') || '#A8620F'
    };
  },

  // 축 눈금을 사람이 읽는 단위로. 1억 이상은 '억', 1만 이상은 '만'.
  chartTick(v, unit){
    if (v == null || !isFinite(v)) return '';
    const a = Math.abs(v);
    if (unit === '원') {
      // '40000억'은 읽는 데 시간이 걸린다 — 1조를 넘으면 조 단위로 적는다
      if (a >= 1e12) return (v / 1e12).toFixed(a >= 1e13 ? 0 : 1) + '조';
      if (a >= 1e8) return (v / 1e8).toFixed(a >= 1e9 ? 0 : 1) + '억';
      if (a >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만';
      return Math.round(v).toLocaleString();
    }
    if (a >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만';
    return (Math.round(v * 10) / 10).toLocaleString();
  },

  // spec → Chart.js 설정
  chartConfig(spec){
    const T = this.chartTheme();
    const unit = spec.unit || '';
    const horizontal = spec.type === 'hbar';
    const kind = (spec.type === 'line') ? 'line' : (spec.type === 'doughnut' ? 'doughnut' : 'bar');
    const many = (spec.labels || []).length > 12;

    const ds = (spec.datasets || []).map((d, i) => {
      const base = {
        label: d.label || '',
        data: d.data,
        borderWidth: kind === 'line' ? 2.4 : 0,
        borderRadius: kind === 'bar' ? 5 : 0,
        // 배열로 주면 막대마다 색이 달라진다.
        //   '#...' → 그 색 그대로 (비교 대상 고유색 — 상권마다 고정)
        //   'on'   → 강조,  'warn' → 주의색,  그 밖 → 연한 기본색
        backgroundColor: d.colors
          ? d.colors.map(c => (typeof c === 'string' && c.charAt(0) === '#') ? c
              : (c === 'on' ? T.accent : (c === 'warn' ? T.warn : T.accent2)))
          : (kind === 'line' ? 'rgba(8,127,107,.10)' : (i === 0 ? T.accent : T.accent2)),
        borderColor: kind === 'line'
          ? (d.color || (i === 0 ? T.accent : T.accent2))
          : 'transparent',
        fill: kind === 'line' ? (spec.fill !== false) : false,
        tension: .32,
        pointRadius: kind === 'line' ? (many ? 0 : 2.5) : 0,
        pointHoverRadius: kind === 'line' ? 5 : 0,
        pointBackgroundColor: T.accent,
        maxBarThickness: horizontal ? 22 : 42
      };
      if (kind === 'doughnut') {
        base.backgroundColor = d.data.map((_, j) =>
          [T.accent, T.accent2, T.good, T.warn, T.ink3, T.accent3][j % 6]);
        base.borderColor = T.bg;
        base.borderWidth = 2;
      }
      return base;
    });

    const axis = {
      grid: { color: T.line, drawTicks: false },
      border: { display: false },
      ticks: {
        color: T.ink3,
        font: { size: 11 },
        padding: 6,
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: horizontal ? 6 : 8
      }
    };
    const valueAxis = {
      ...axis,
      beginAtZero: true,
      ticks: { ...axis.ticks, callback: v => this.chartTick(v, unit) }
    };
    const catAxis = {
      ...axis,
      grid: { display: false, drawTicks: false },
      ticks: { ...axis.ticks, autoSkip: !horizontal, maxTicksLimit: horizontal ? 99 : 8 }
    };

    return {
      type: kind,
      data: { labels: spec.labels || [], datasets: ds },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        animation: { duration: 250 },
        // 창 크기가 바뀔 때마다 막대가 0부터 다시 자라면 읽는 사람이 어지럽다
        transitions: { resize: { animation: { duration: 0 } } },
        resizeDelay: 80,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 4, right: 4 } },
        scales: kind === 'doughnut' ? {} : (horizontal
          ? { x: valueAxis, y: catAxis }
          : { x: catAxis, y: valueAxis }),
        plugins: {
          legend: {
            display: (spec.datasets || []).length > 1 || kind === 'doughnut',
            position: 'bottom',
            labels: { color: T.ink2, boxWidth: 10, boxHeight: 10, font: { size: 11.5 }, padding: 12, usePointStyle: true }
          },
          tooltip: {
            backgroundColor: T.ink,
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF',
            padding: 10,
            cornerRadius: 8,
            displayColors: (spec.datasets || []).length > 1,
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed[horizontal ? 'x' : 'y'] ?? ctx.parsed;
                const n = (unit === '원')
                  ? this.fmt(v) + '원'
                  : (Math.round(v * 10) / 10).toLocaleString() + unit;
                return (ctx.dataset.label ? ctx.dataset.label + ' · ' : '') + n;
              }
            }
          }
        }
      }
    };
  },

  // 화면에 있는 <canvas data-chart="..."> 를 spec 과 맞춘다.
  // 같은 canvas 는 update, 사라진 것은 destroy — 다시 그릴 때마다 새로 만들면 메모리가 샌다.
  paintCharts(){
    const Chart = globalThis.Chart;
    if (!Chart) return;
    const specs = this._charts || {};
    this._chartInst = this._chartInst || {};

    // 사라진 차트 정리
    for (const id of Object.keys(this._chartInst)) {
      const el = document.querySelector('[data-chart="' + id + '"]');
      if (!el || !specs[id]) { try { this._chartInst[id].destroy(); } catch (e) {} delete this._chartInst[id]; }
    }
    for (const id of Object.keys(specs)) {
      const el = document.querySelector('[data-chart="' + id + '"]');
      if (!el) continue;
      const spec = specs[id];
      const sig = JSON.stringify([spec.type, spec.labels, spec.datasets, this._theme]);
      const inst = this._chartInst[id];
      if (inst && inst.canvas === el) {
        if (inst._sig === sig) continue;            // 값이 같으면 다시 그리지 않는다
        try { inst.destroy(); } catch (e) {}
      } else if (inst) {
        try { inst.destroy(); } catch (e) {}
      }
      let made;
      try { made = new Chart(el.getContext('2d'), this.chartConfig(spec)); }
      catch (e) { continue; }
      made._sig = sig;
      this._chartInst[id] = made;
    }
  },

  // 화면(view model)에서 차트를 등록한다. 반환값은 마크업이 쓸 껍데기.
  // data 가 비면 null 을 돌려주고, 화면은 그 자리를 아예 안 그린다(빈 차트 금지).
  chartCard(id, opt){
    const labels = opt.labels || [];
    const sets = (opt.datasets || []).filter(d => Array.isArray(d.data) && d.data.some(v => v != null && isFinite(v)));
    if (!labels.length || !sets.length) return null;
    this._charts = this._charts || {};
    this._charts[id] = { type: opt.type || 'bar', unit: opt.unit || '', labels, datasets: sets, fill: opt.fill };
    // 승자 표시(§7) — 색이 아니라 배지와 한 줄 문장으로 말한다.
    // 낮을수록 좋은 지표(경쟁·임대료·공실)는 부르는 쪽에서 방향을 이미 뒤집어 넘긴다.
    const w = opt.winner || null;
    return {
      id,
      title: opt.title || '',
      sub: opt.sub || '',
      hasSub: !!opt.sub,
      hasWinner: !!w,
      winName: w ? w.name : '',
      winValue: w ? w.value : '',
      winBadge: w ? w.badge : '',
      winText: w ? w.text : '',
      winDot: w ? 'flex:none;width:9px;height:9px;border-radius:50%;background:' + (w.color || 'var(--accent)') : '',
      winBadgeStyle: 'flex:none;font-size:11.5px;font-weight:700;padding:4px 9px;border-radius:999px;'
        + 'white-space:nowrap;background:var(--color-primary-soft);color:var(--color-primary)',
      // 화면에서 '기준 …'을 앞에 붙이므로 '2026년 1분기 기준 기준'이 되지 않게 꼬리를 뗀다
      period: (opt.period || '').replace(/\s*기준\s*$/, ''),
      hasPeriod: !!opt.period,
      height: (opt.height || 220) + 'px',
      style: 'background:var(--bg);border:1px solid var(--line);box-shadow:var(--shadow-card);'
        + 'border-radius:var(--r-lg);padding:20px;min-width:0;display:flex;flex-direction:column'
    };
  }
};
