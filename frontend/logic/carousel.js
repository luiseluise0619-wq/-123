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
    // 모바일은 90% — 지금 카드가 거의 다 보이고 다음 카드는 10%만 살짝 걸친다(§9).
    // 절반씩 잘려 보이면 '두 개를 동시에 읽어야 하나' 싶어진다.
    // peek:false 면 좁은 칸(세로 메뉴 옆) 이라 잘라 보일 자리가 없다 → 한 장을 꽉 채운다
    const basis = this.L(o.peek === false ? '100%' : '90%',
      per === 1 ? '100%' : 'calc((100% - 16px)/2)',
      per === 1 ? '100%' : 'calc((100% - ' + (per - 1) * 20 + 'px)/' + per + ')');
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
      // arrows:true 로 넘기면 모바일에서도 낸다 — 잘려 보이는 자리가 없어 '더 있다'가 안 읽히는 칸에서만.
      arrows: o.arrows === true ? true : this.bp() === 'desktop',
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

  // 화살표 한 번에 한 장씩. 카드 폭을 재서 미는 대신 '다음 카드의 시작점'으로 보낸다 —
  // 폭 계산이 어긋나면 두 장씩 넘어가 버린다(실제로 그랬다).
  railMove(key, dir){
    const el = document.querySelector('[data-rail="' + key + '"]');
    if (!el || !el.children.length) return;
    const base = el.getBoundingClientRect().left - el.scrollLeft;
    // 각 카드의 트랙 안 시작 위치
    const stops = [...el.children].map(c => Math.round(c.getBoundingClientRect().left - base));
    const now = el.scrollLeft;
    // 반올림 오차로 제자리에 머무는 걸 막는다(1px 여유)
    const next = dir > 0
      ? stops.find(x => x > now + 1)
      : [...stops].reverse().find(x => x < now - 1);
    const max = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: Math.max(0, Math.min(next == null ? (dir > 0 ? max : 0) : next, max)),
                  behavior: 'smooth' });
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
        // 끄는 동안에는 스냅과 부드러운 스크롤을 잠시 끈다.
        // 켜 둔 채로 scrollLeft 를 직접 넣으면 브라우저가 계속 되돌려서
        // 손을 따라오지 않고 뚝뚝 끊긴다(실제로 그랬다).
        el.style.scrollSnapType = 'none';
        el.style.scrollBehavior = 'auto';
        // setPointerCapture 는 쓰지 않는다 — 포인터 이벤트가 트랙으로 몰려서
        // 안에 있는 카드의 click 이 죽는다(실제로 '+ 담기'가 안 눌렸다).
      });
      el.addEventListener('pointermove', e => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 3) {
          e.preventDefault();                 // 끌기 시작한 뒤에만. 그냥 누른 건 클릭으로 남긴다
          el.scrollLeft = startLeft - dx; moved = Math.abs(dx);
        }
      });
      // 손을 떼면 가장 가까운 카드로 부드럽게 붙인다 — 반쯤 걸친 채로 멈추지 않게
      const up = () => {
        if (!down) return;
        down = false;
        el.style.cursor = 'grab';
        el.style.scrollBehavior = 'smooth';
        const base = el.getBoundingClientRect().left - el.scrollLeft;
        const stops = [...el.children].map(c => Math.round(c.getBoundingClientRect().left - base));
        const max = el.scrollWidth - el.clientWidth;
        if (stops.length) {
          const near = stops.reduce((a, b) => Math.abs(b - el.scrollLeft) < Math.abs(a - el.scrollLeft) ? b : a);
          el.scrollTo({ left: Math.max(0, Math.min(near, max)), behavior: 'smooth' });
        }
        // 스냅은 붙는 애니메이션이 끝난 뒤에 되돌린다(도중에 켜면 튄다)
        setTimeout(() => { el.style.scrollSnapType = ''; }, 320);
      };
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
