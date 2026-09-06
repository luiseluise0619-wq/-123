'use strict';
// 상권 이름의 로마자 표기 — 영어 화면에서만 쓴다.
//
// 왜 번역이 아니라 표기 변환인가
//   '성수역'은 뜻을 옮기는 대상이 아니라 이름이다. 뜻을 옮기면 오히려 못 찾는다.
//   그래서 국립국어원 '국어의 로마자 표기법'(Revised Romanization)대로 소리를 옮긴다.
//   이건 지어낸 값이 아니라 규칙에 따른 기계적 변환이다.
//   중국어 화면에서는 그대로 한글을 둔다 — 한자 표기를 우리가 만들어 낼 수 없고,
//   추측해서 붙이면 그건 지어낸 값이 된다.
//
// 어디까지 하나
//   음운 변화(자음 동화)까지 반영한다. 이게 없으면 종로가 'Jongro'(틀림)로 나온다.
//   지명 뒤에 흔히 붙는 말(역·시장·사거리…)은 영어 표기 관행대로 바꾼다.
//   tests/roman.test.js 가 서울시 공식 표기와 맞는지 확인한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.roman = {

  // 초성 19 · 중성 21 · 종성 28 (유니코드 한글 음절 조합 순서)
  RR_CHO(){ return ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h']; },
  RR_JUNG(){ return ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i']; },
  // 받침의 '대표음'(끝소리 규칙). 다음 글자가 모음이면 연음되므로 따로 처리한다.
  //   ㄱㄲㄳ→k  ㄴㄵㄶ→n  ㄷ→t  ㄹㄺ…→l/k  ㅁ→m  ㅂㅄ→p  ㅅㅆ→t  ㅇ→ng  ㅈㅊ→t  ㅋ→k  ㅌ→t  ㅍ→p  ㅎ→t
  RR_JONG(){ return ['','k','k','k','n','n','n','t','l','k','m','p','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t']; },
  // 연음될 때 다음 글자 초성으로 넘어가는 소리
  RR_JONG_LINK(){ return ['','g','kk','ks','n','nj','n','d','r','lg','lm','lb','ls','lt','lp','r','m','b','bs','s','ss','ng','j','ch','k','t','p','']; },

  // 받침 + 다음 초성 → 바뀌는 소리(자음 동화). 규칙에 없는 조합은 그대로 둔다.
  // 이게 없으면 종로가 'Jongro'(틀림)로 나온다.
  RR_ASSIM(){
    return {
      'k n':['ng','n'], 'k r':['ng','n'], 'k m':['ng','m'],
      't n':['n','n'],  't r':['n','n'],  't m':['n','m'],
      'p n':['m','n'],  'p r':['m','n'],  'p m':['m','m'],
      'n r':['l','l'],  'l n':['l','l'],
      'ng r':['ng','n'],'m r':['m','n'],
      'k h':['k',''],   't h':['t',''],   'p h':['p','']
    };
  },

  // 이름 뒤에 붙는 말 — 소리로 옮기지 않고 영어 관행대로 적는다
  RR_SUFFIX(){
    return [
      ['관광특구',' Special Tourist Zone'], ['특화거리',' Themed Street'],
      ['초등학교',' Elem. School'], ['중학교',' Middle School'], ['고등학교',' High School'],
      ['대학교',' Univ.'], ['대학병원',' Univ. Hospital'], ['도서관',' Library'],
      ['주민센터',' Community Center'], ['우체국',' Post Office'], ['세무서',' Tax Office'],
      ['사거리',' Intersection'], ['교차로',' Intersection'], ['아파트',' Apt.'],
      ['체육관',' Gym'], ['시장',' Market'], ['공원',' Park'], ['병원',' Hospital'],
      ['터미널',' Terminal'], ['백화점',' Dept. Store'], ['타워',' Tower'], ['센터',' Center'],
      // 도로명(로·길·대로)은 따로 손대지 않는다. 소리 그대로 옮기는 편이
      // 공식 표기와 더 자주 맞는다: 을지로→Euljiro · 종로→Jongno · 충무로→Chungmuro.
      ['역',' Stn.'], ['점',' Branch']
    ];
  },

  // 소리로 옮기면 표지판 표기와 달라지는 몇 곳. 규칙으로는 구분할 수 없어 손으로 둔다.
  // (형태소 경계에 따라 ㄴ+ㄹ 이 'll' 도 되고 'nn' 도 되는데, 이름만 보고는 알 수 없다.)
  RR_EXCEPT(){
    return {'테헤란로':'Teheran-ro','강남대로':'Gangnam-daero','도산대로':'Dosan-daero',
            '논현로':'Nonhyeon-ro','올림픽로':'Olympic-ro','왕산로':'Wangsan-ro'};
  },

  // 한 덩어리(한글만)를 로마자로
  romanizeWord(w){
    const CHO=this.RR_CHO(), JUNG=this.RR_JUNG(), JONG=this.RR_JONG(),
          LINK=this.RR_JONG_LINK(), AS=this.RR_ASSIM();
    const parts=[];   // [초성, 중성, 종성인덱스]
    for(const ch of String(w)){
      const c=ch.charCodeAt(0)-0xAC00;
      if(c<0||c>=11172) return null;                  // 한글 음절이 아니면 포기
      parts.push([Math.floor(c/588), Math.floor((c%588)/28), c%28]);
    }
    let out='';
    let override=null;                                 // 앞 글자 받침이 넘겨준 초성 소리
    for(let i=0;i<parts.length;i++){
      const cho=parts[i][0], jung=parts[i][1], jong=parts[i][2];
      const next=parts[i+1];
      out += (override!=null? override : CHO[cho]) + JUNG[jung];
      override=null;
      if(!jong) continue;
      if(next && next[0]===11){                        // 다음 글자 초성이 'ㅇ' → 연음
        override=LINK[jong];
        continue;
      }
      const tail=JONG[jong];
      if(next){
        const rule=AS[tail+' '+CHO[next[0]]];
        if(rule){ out+=rule[0]; override=rule[1]; continue; }
      }
      out += tail;
    }
    return out;
  },

  // 상권 이름 하나. 뒤에 붙는 말은 영어 표기로, 나머지는 소리로 옮긴다.
  romanizeName(name){
    let s=String(name||'').trim();
    if(!s || !/[가-힣]/.test(s)) return s;
    if(this.RR_EXCEPT()[s]) return this.RR_EXCEPT()[s];
    let suffix='';
    // '역삼역 8번' 처럼 뒤에 붙는 출구 번호 · '도곡2동' 처럼 붙는 행정동 번호
    const exit=s.match(/\s*(\d+)\s*번$/);
    if(exit){ suffix=' Exit '+exit[1]; s=s.slice(0,exit.index); }
    const dong=s.match(/(\d+)동$/);
    if(dong){ suffix=' '+dong[1]+'-dong'+suffix; s=s.slice(0,dong.index); }
    for(const [ko,en] of this.RR_SUFFIX()){
      if(s.length>ko.length && s.endsWith(ko)){ suffix=en+suffix; s=s.slice(0,-ko.length); break; }
    }
    s=s.trim();
    // 공백·가운뎃점·빗금으로 나뉜 덩어리를 각각 옮긴다
    const EX=this.RR_EXCEPT();
    const parts=s.split(/([\s·\/]+)/).map(seg=>{
      if(/^[\s·\/]+$/.test(seg)) return seg;
      if(!/[가-힣]/.test(seg)) return seg;             // 숫자·영문은 그대로
      if(EX[seg]) return EX[seg];
      // 한글 덩어리와 숫자·영문이 섞여 있으면 한글 덩어리만 골라 바꾼다('논현로12길')
      return seg.replace(/[가-힣]+/g, run=>{
        const r=this.romanizeWord(run);
        return r===null? run : r;
      });
    }).join('');
    const done=(parts.replace(/\s{2,}/g,' ').trim() + suffix).trim();
    // 첫 글자만 대문자. 덩어리마다 올리면 'Nonhyeollo12Gil' 처럼 어색해진다.
    return done.replace(/(^|[\s·\/])([a-z])/g, (m,a,b)=>a+b.toUpperCase());
  }
};
