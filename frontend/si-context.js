// 화면끼리 공유하는 '내 조건' 한 벌.
//
// 왜 필요한가
//   진단에서 "강남구 · 커피-음료 · 15평 · 자금 8,000만"을 넣고 맞춤 탐색으로 가면
//   업종을 처음부터 다시 골라야 했다. 비교로 가면 또 골라야 했다.
//   화면은 넷인데 사용자가 준비하는 가게는 하나다. 한 번 말한 건 기억해야 한다.
//
// 어떻게
//   로그인도 서버도 없이 이 브라우저에만 저장한다(localStorage).
//   개인정보가 아니라 '지금 보고 있는 조건'이다 — 이메일·이름 같은 건 절대 넣지 않는다.
//
// 우선순위 — 주소가 항상 이긴다
//   공유 링크(?gu=..&ind=..)로 들어온 사람에게 내 저장값을 덮어씌우면
//   보내준 사람이 의도한 화면이 안 나온다. 그래서 URL 파라미터 > 저장값 순서다.
//
// 쓰는 법
//   <script src="si-context.js"></script>          // 평범한 script, defer 금지
//   var c = SI.get();                              // {gu, ind, area, ...}
//   SI.set({ind:'커피-음료', area:20});             // 저장 + 다른 탭에 알림
//   SI.pick('ind', urlValue);                      // URL 값이 있으면 그걸, 없으면 저장값
//   SI.onChange(function(c){ ... });               // 다른 탭에서 바뀌면 호출
//
// 저장하는 것 — 화면이 다시 묻지 않아도 되는 값만
//   gu 자치구 · ind 업종 · area 평수 · budget 가진 자금(만원)
//   sales 내 월매출(만원) · rent 월세(만원) · staff 직원 수
//   mode 'new'(창업 준비) | 'run'(운영 중) · zone 상권코드 · zoneNm 상권명
(function (g) {
  "use strict";
  var KEY = "si.ctx.v1";
  // 여기 없는 키는 저장하지 않는다. 화면이 실수로 개인정보를 흘려 넣는 것을 막는다.
  var ALLOW = ["gu", "ind", "area", "budget", "sales", "rent", "staff", "mode", "zone", "zoneNm"];

  function read() {
    // 사생활 보호 모드·저장 차단에서는 접근 자체가 예외를 던진다. 전부 감싼다.
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "{}");
      return (o && typeof o === "object") ? o : {};
    } catch (e) { return {}; }
  }
  function write(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; }
    catch (e) { return false; }        // 저장이 막혀 있어도 화면은 계속 동작해야 한다
  }

  var listeners = [];

  var SI = {
    get: read,

    /** 허용된 키만 골라 저장한다. null/'' 를 넣으면 그 값을 지운다. */
    set: function (patch) {
      if (!patch) return read();
      var cur = read(), changed = false;
      for (var k in patch) {
        if (ALLOW.indexOf(k) < 0) continue;
        var v = patch[k];
        if (v === null || v === "" || v === undefined) {
          if (k in cur) { delete cur[k]; changed = true; }
        } else if (cur[k] !== v) {
          cur[k] = v; changed = true;
        }
      }
      if (!changed) return cur;
      write(cur);
      listeners.forEach(function (fn) { try { fn(cur); } catch (e) {} });
      return cur;
    },

    /** URL 값이 있으면 그것(그리고 저장), 없으면 저장값. 없으면 fallback. */
    pick: function (key, urlValue, fallback) {
      if (urlValue !== null && urlValue !== undefined && urlValue !== "") {
        var patch = {}; patch[key] = urlValue; SI.set(patch);
        return urlValue;
      }
      var c = read();
      return (c[key] !== undefined && c[key] !== null && c[key] !== "") ? c[key] : fallback;
    },

    /** 숫자 값 전용 pick — '15' 같은 문자열을 숫자로 맞춰 돌려준다. */
    pickNum: function (key, urlValue, fallback) {
      var v = SI.pick(key, urlValue, null);
      var n = (v === null || v === "") ? NaN : +v;
      return isNaN(n) ? fallback : n;
    },

    /** 다른 탭에서 바뀌었을 때. 같은 탭 안의 set() 도 함께 알린다. */
    onChange: function (fn) {
      listeners.push(fn);
      g.addEventListener("storage", function (e) {
        if (e && e.key === KEY) { try { fn(read()); } catch (err) {} }
      });
    },

    /** '지금 조건'을 한 줄로. 화면 위에 "이어서 보고 있습니다"를 띄울 때 쓴다. */
    label: function () {
      var c = read(), p = [];
      if (c.gu) p.push(c.gu);
      if (c.ind) p.push(c.ind);
      if (c.area) p.push(c.area + "평");
      return p.join(" · ");
    },

    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };

  g.SI = SI;
})(window);
