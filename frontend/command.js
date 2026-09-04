/* ─────────────────────────────────────────────────────────────
   명령 팔레트 (⌘K / Ctrl+K) — 어느 페이지에서든 상권·업종·화면을 바로 찾는다.

   왜 필요한가
     우리는 상권 1,564곳 × 업종 62개를 다룬다. 메뉴 4개로는 못 닿는다.
     그렇다고 메뉴를 늘리면 화면이 복잡해진다.
     "필요한 순간에 화면 안에서 접근하게 한다"는 원칙의 가장 강한 형태다.
     (nellavio 대시보드 스타터의 command palette 패턴)

   쓰는 법 — theme.css 뒤, 페이지 스크립트 아무 곳에서나
     <script src="command.js" defer></script>
   페이지가 상권 목록을 갖고 있으면 알려 준다(없으면 화면 이동만 검색된다):
     window.__cmdZones = [{cd,nm,gu,dong}, ...]

   의존성 0. 외부 라이브러리 없음.
   ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  // 이동할 수 있는 화면들 — 메뉴에 없는 것도 여기서는 닿는다.
  var PAGES = [
    { t: "기회 상권 찾기", d: "업종을 골라 시장 공백 보기", u: "zone.html" },
    { t: "맞춤 상권 찾기", d: "업종·예산·중요한 조건으로 추리기", u: "zone.html#fit" },
    { t: "상권 지도", d: "자치구 지도에서 훑어보기", u: "index.html" },
    { t: "손익 진단", d: "조건 넣고 손익분기 계산", u: "mvp.html" },
    { t: "비교", d: "자치구·상권·임대료 나란히", u: "compare.html" },
    { t: "건물 지도", d: "핀 찍어 그 지점 브리핑", u: "building.html" },
    { t: "연도별 추이", d: "업종·자치구 시계열", u: "trends.html" },
    { t: "지원 제도 찾기", d: "단계·필요한 것으로 정부 지원 공고 추리기", u: "support.html" },
    { t: "데이터", d: "쓰는 자료 열 가지", u: "index.html#data" },
    { t: "상담", d: "데이터 근거로 답하기", u: "index.html#chat" },
    { t: "서비스 소개", d: "무엇을 하는 서비스인가", u: "about.html" },
    { t: "개인정보 처리방침", d: "무엇을 수집하고 얼마나 보관하나", u: "privacy.html" }
  ];

  var el, input, list, items = [], sel = 0, open = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function build() {
    el = document.createElement("div");
    el.className = "cmdk";
    el.innerHTML =
      '<div class="cmdk-scrim"></div>' +
      '<div class="cmdk-box" role="dialog" aria-modal="true" aria-label="검색">' +
        '<input class="cmdk-input" type="text" placeholder="상권 · 업종 · 화면 검색" ' +
          'autocomplete="off" spellcheck="false" aria-controls="cmdk-list">' +
        '<div class="cmdk-list" id="cmdk-list" role="listbox"></div>' +
        '<div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 이동</span>' +
          '<span><kbd>Enter</kbd> 열기</span><span><kbd>Esc</kbd> 닫기</span></div>' +
      "</div>";
    document.body.appendChild(el);
    input = el.querySelector(".cmdk-input");
    list = el.querySelector(".cmdk-list");

    el.querySelector(".cmdk-scrim").addEventListener("click", close);
    input.addEventListener("input", function () { search(input.value); });
    input.addEventListener("keydown", onKey);
    list.addEventListener("click", function (e) {
      var r = e.target.closest("[data-i]");
      if (r) go(items[+r.dataset.i]);
    });
    // 마우스를 올린 항목이 곧 선택 항목 — 키보드와 마우스 선택이 어긋나지 않게
    list.addEventListener("mousemove", function (e) {
      var r = e.target.closest("[data-i]");
      if (r && +r.dataset.i !== sel) { sel = +r.dataset.i; paintSel(); }
    });
  }

  function search(q) {
    q = (q || "").trim();
    items = [];
    var zones = window.__cmdZones || [];
    var inds = window.__cmdInds || [];

    if (!q) {
      // 빈 입력일 때는 화면 목록을 보여준다(무엇을 할 수 있는지 알려주는 역할)
      items = PAGES.slice(0, 6).map(function (p) {
        return { kind: "화면", t: p.t, d: p.d, u: p.u };
      });
    } else {
      inds.filter(function (k) { return k.indexOf(q) >= 0; }).slice(0, 4).forEach(function (k) {
        items.push({ kind: "업종", t: k, d: "이 업종의 기회 상권 보기",
                     u: "zone.html?ind=" + encodeURIComponent(k) });
      });
      zones.filter(function (z) {
        return (z.nm && z.nm.indexOf(q) >= 0) || (z.gu && z.gu.indexOf(q) >= 0) ||
               (z.dong && z.dong.indexOf(q) >= 0);
      }).sort(function (a, b) {
        // 이름이 정확히 시작하는 것 → 상업 규모가 있는 곳 → 매출 큰 곳 순.
        // 이렇게 안 하면 "강남"에 근린공원·병원·아파트가 먼저 나온다(실제로 그랬다).
        var as = (a.nm || "").indexOf(q) === 0 ? 0 : 1, bs = (b.nm || "").indexOf(q) === 0 ? 0 : 1;
        return as - bs || (a.weak ? 1 : 0) - (b.weak ? 1 : 0) || (b.sales || 0) - (a.sales || 0);
      }).slice(0, 8).forEach(function (z) {
        items.push({ kind: "상권", t: z.nm,
                     d: [z.gu, z.dong].filter(Boolean).join(" · ") + (z.weak ? " · 비교 제한" : ""),
                     u: "zone.html#z=" + z.cd });
      });
      PAGES.filter(function (p) { return p.t.indexOf(q) >= 0 || p.d.indexOf(q) >= 0; })
        .slice(0, 4).forEach(function (p) {
          items.push({ kind: "화면", t: p.t, d: p.d, u: p.u });
        });
    }
    sel = 0;
    paint(q);
  }

  function paint(q) {
    if (!items.length) {
      list.innerHTML =
        '<div class="cmdk-empty"><b>‘' + esc(q) + '’에 대한 결과가 없습니다</b>' +
        "<span>상권 이름·자치구·업종으로 찾아보세요.</span></div>";
      return;
    }
    list.innerHTML = items.map(function (it, i) {
      return '<div class="cmdk-item' + (i === sel ? " on" : "") + '" data-i="' + i +
        '" role="option" aria-selected="' + (i === sel) + '">' +
        '<span class="cmdk-kind">' + esc(it.kind) + "</span>" +
        '<span class="cmdk-t">' + esc(it.t) + "</span>" +
        '<span class="cmdk-d">' + esc(it.d) + "</span></div>";
    }).join("");
  }

  function paintSel() {
    var kids = list.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle("on", i === sel);
      kids[i].setAttribute("aria-selected", String(i === sel));
    }
    if (kids[sel]) kids[sel].scrollIntoView({ block: "nearest" });
  }

  function onKey(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      sel += e.key === "ArrowDown" ? 1 : -1;
      if (sel < 0) sel = items.length - 1;
      if (sel >= items.length) sel = 0;
      paintSel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[sel]) go(items[sel]);
    } else if (e.key === "Escape") {
      e.preventDefault(); close();
    }
  }

  function go(it) {
    if (!it) return;
    close();
    // 같은 페이지 안의 해시 이동이면 새로고침 없이(상태 유지)
    var here = location.pathname.split("/").pop() || "index.html";
    var target = it.u.split("#")[0].split("?")[0];
    if (target === here && it.u.indexOf("#") >= 0) location.hash = it.u.split("#")[1];
    else location.href = it.u;
  }

  var lastFocus = null;
  function show() {
    if (!el) build();
    lastFocus = document.activeElement;
    open = true;
    el.classList.add("on");
    input.value = "";
    search("");
    input.focus();
  }
  function close() {
    if (!open) return;
    open = false;
    el.classList.remove("on");
    // 열기 전에 보던 곳으로 포커스를 돌려준다(키보드 사용자가 길을 잃지 않게)
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
  }

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault(); open ? close() : show();
    } else if (e.key === "/" && !open) {
      // 입력 중이 아닐 때만 '/' 로 열기
      var t = e.target.tagName;
      if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.target.isContentEditable) return;
      e.preventDefault(); show();
    }
  });

  // 헤더의 검색 단추(있으면) 로도 열 수 있게
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-cmdk-open]")) { e.preventDefault(); show(); }
  });

  window.openCommandPalette = show;
})();
