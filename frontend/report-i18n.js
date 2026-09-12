'use strict';
// 인쇄 리포트(report-print.html)의 말 바꾸기.
//
// 왜 따로 있나
//   인쇄본은 앱과 다른 페이지라 앱의 i18n(logic/i18n.js)을 싣지 않는다.
//   그래서 화면을 영어로 보다가 PDF 만 한국어로 받는 일이 있었다.
//   같은 표(locales/*.json 의 "@phrases")를 써서 그린 뒤 한 번 훑는다 —
//   앱의 trDom 과 같은 방식이다. 표에 없는 문장은 한국어 그대로 둔다(억지로 바꾸지 않는다).
//
// 고유명사(상권·기관·공고 제목)는 표에 없어 원문 그대로 남는다. 그게 맞다.
globalThis.MysbizonReportI18n = (function(){
  var table=null;

  // 숫자를 자리표시자로 바꾼 꼴. '3곳' → '{0}곳'
  function norm(s){
    var nums=[];
    var key=String(s).replace(/-?\d[\d,]*(\.\d+)?/g, function(m){ nums.push(m); return '{'+(nums.length-1)+'}'; });
    return {key:key, nums:nums};
  }
  function tr(s){
    if(!table || typeof s!=='string' || !s || !/[가-힣]/.test(s)) return s;
    if(table[s]!=null) return table[s];
    var n=norm(s), hit=table[n.key];
    if(hit==null) return s;
    return n.nums.reduce(function(acc,v,i){ return acc.split('{'+i+'}').join(v); }, hit);
  }
  var SKIP={SCRIPT:1, STYLE:1, CANVAS:1, SVG:1, PATH:1};
  function walk(node){
    for(var n=node.firstChild; n; n=n.nextSibling){
      if(n.nodeType===3){
        var t=n.nodeValue;
        if(t && /[가-힣]/.test(t)){
          var trimmed=t.trim(), out=tr(trimmed);
          if(out!==trimmed) n.nodeValue=t.replace(trimmed,out);
        }
        continue;
      }
      if(n.nodeType!==1 || SKIP[n.tagName]) continue;
      var v=n.getAttribute && n.getAttribute('aria-label');
      if(v && /[가-힣]/.test(v)){ var o=tr(v.trim()); if(o!==v.trim()) n.setAttribute('aria-label',o); }
      walk(n);
    }
  }

  return {
    // 사전을 한 번 받아 둔다. 한국어면 아무것도 하지 않는다.
    load:function(){
      var loc='ko';
      try{ loc=(JSON.parse(localStorage.getItem('mysbizon.theme')||'{}').locale)||'ko'; }catch(e){}
      if(loc==='ko' || (loc!=='en' && loc!=='zh-CN')) return Promise.resolve(false);
      var embedded=globalThis.MysbizonBootstrap && globalThis.MysbizonBootstrap.locales && globalThis.MysbizonBootstrap.locales[loc];
      if(embedded){
        table=embedded['@phrases'] || null;
        if(table) document.documentElement.setAttribute('lang', loc==='zh-CN'?'zh-CN':'en');
        return Promise.resolve(!!table);
      }
      return fetch('./locales/'+loc+'.json')
        .then(function(r){ return r.ok? r.json() : null; })
        .then(function(j){
          table=(j && j['@phrases']) || null;
          if(table) document.documentElement.setAttribute('lang', loc==='zh-CN'?'zh-CN':'en');
          return !!table;
        })
        .catch(function(){ return false; });
    },
    // 이름을 끼워 만드는 문장은 그리기 전에 옮겨야 한다(자리표시자 {0} 를 그대로 돌려준다)
    tr:tr,
    apply:function(){ if(table){ try{ walk(document.body); }catch(e){} } }
  };
})();
