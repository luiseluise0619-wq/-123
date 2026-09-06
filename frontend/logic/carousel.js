'use strict';
// 가로 슬라이드 — 카드가 여럿일 때 세로로 늘어놓지 않고 옆으로 넘겨 본다.
//
// 데스크톱: 한 화면에 3~4장 · 좌우 화살표 · 마우스 드래그 · 세로 휠 → 가로 이동
// 모바일:   1~1.2장 · 손가락 스와이프(브라우저 기본 스크롤을 그대로 쓴다)
//
// 왜 라이브러리를 안 쓰나
//   CSS scroll-snap + overflow-x 만으로 스와이프·관성·접근성이 다 된다.
//   여기 코드는 '화살표'와 '드래그'와 '휠'만 얹는다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.carousel = {

  // 화면(view model)에서 부른다. 트랙과 화살표에 쓸 스타일·동작을 돌려준다.
  // per: 데스크톱에서 한 화면에 몇 장 보일지
  rail(key, opt){
    const o = opt || {};
    const per = o.per || 3;
    // 모바일은 1.15장 — 오른쪽이 살짝 잘려 보여야 '더 있다'는 게 읽힌다
    const basis = this.L('82%', 'calc((100% - 16px)/2)', 'calc((100% - ' + (per - 1) * 20 + 'px)/' + per + ')');
    return {
      key,
      trackId: 'rail-' + key,
      trackStyle: 'display:flex;gap:' + this.L('12px', '16px', '20px') + ';overflow-x:auto;'
        + 'scroll-snap-type:x mandatory;scroll-behavior:smooth;padding:4px 2px 10px;'
        + '-webkit-overflow-scrolling:touch;scrollbar-width:none;cursor:grab',
      itemStyle: 'flex:0 0 ' + basis + ';scroll-snap-align:start;min-width:0',
      prev: () => this.railMove(key, -1),
      next: () => this.railMove(key, 1),
      // 화살표는 데스크톱에서만. 손가락으로 넘기는 화면에 화살표는 군더더기다.
      arrows: this.bp() === 'desktop',
      arrowStyle: 'flex:none;width:34px;height:34px;border-radius:50%;background:var(--surface);'
        + 'color:var(--ink2);display:inline-flex;align-items:center;justify-content:center;'
        + 'cursor:pointer;font-size:15px;transition:background .14s;user-select:none'
    };
  },

  // 몇 번째 카드로 보내기. 차트 이름을 눌러 그 차트로 건너뛸 때 쓴다(§8).
  railTo(key, i){
    const el = document.querySelector('[data-rail="' + key + '"]');
    if (!el || !el.children[i]) return;
    el.scrollTo({ left: el.children[i].offsetLeft - el.offsetLeft, behavior: 'smooth' });
  },

  railMove(key, dir){
    const el = document.querySelector('[data-rail="' + key + '"]');
    if (!el) return;
    const first = el.firstElementChild;
    const step = first ? (first.getBoundingClientRect().width + 20) : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step * (this.bp() === 'desktop' ? 2 : 1), behavior: 'smooth' });
  },

  // 드래그로 밀기 + 세로 휠을 가로 이동으로. 트랙마다 한 번만 붙인다.
  bindRails(){
    const rails = document.querySelectorAll('[data-rail]');
    rails.forEach(el => {
      if (el._railBound) return;
      el._railBound = true;

      let down = false, startX = 0, startLeft = 0, moved = 0;
      el.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') return;          // 손가락은 브라우저 기본 스크롤이 낫다
        down = true; moved = 0;
        startX = e.clientX; startLeft = el.scrollLeft;
        el.style.cursor = 'grabbing';
      });
      el.addEventListener('pointermove', e => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 3) { el.scrollLeft = startLeft - dx; moved = Math.abs(dx); }
      });
      const up = () => { down = false; el.style.cursor = 'grab'; };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('pointercancel', up);
      // 드래그로 밀고 손을 뗄 때 카드가 눌리는 걸 막는다
      el.addEventListener('click', e => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);

      // 트랙패드 가로 스크롤은 그대로 두고, 세로 휠만 가로로 바꾼다
      el.addEventListener('wheel', e => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        const max = el.scrollWidth - el.clientWidth;
        if (max <= 1) return;
        const next = el.scrollLeft + e.deltaY;
        if (next < 0 || next > max) return;             // 끝에 닿으면 페이지 스크롤을 돌려준다
        e.preventDefault();
        el.scrollLeft = next;
      }, { passive: false });
    });
  }
};
