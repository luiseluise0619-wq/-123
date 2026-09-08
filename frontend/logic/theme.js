'use strict';
// 테마 — 화면 색·글자 색·차트 색을 사장님이 바꾼다.
//
// 어떻게 도는가
//   토큰(--color-primary 등)은 _shell-head 의 :root 와 html[data-theme="dark"] 에 있다.
//   여기서는 <html> 의 인라인 스타일로 그 토큰만 덮어쓴다.
//   화면 코드는 전부 var(--color-…) 를 쓰므로, 한 곳만 바꾸면 전체가 따라온다.
//   CSS filter 로 색을 뒤집지 않는다 — 그러면 차트·그림자·이미지까지 망가진다.
//
// 저장
//   비로그인이라 localStorage 에 둔다. 로그인 붙이면 user_preferences 로 옮기면 된다(§45).
//
// 화면(appearance)
//   light / dark / system. system 은 브라우저 설정을 따라가고, 설정이 바뀌면 즉시 반영한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.theme = {

  // 프리셋. primary 계열 넷과 차트 색 셋만 정한다 — 나머지는 공통 토큰을 그대로 쓴다.
  THEME_PRESETS(){
    return [
      {k:'mint',   label:'MYSBIZON Mint',
       light:{primary:'#087F6B', hover:'#0F6B59', mid:'#7FBCAE', soft:'#E8F5F1'},
       dark: {primary:'#3FA88F', hover:'#6FC4AE', mid:'#2E7565', soft:'#12332C'}},
      {k:'ocean',  label:'Ocean Blue',
       light:{primary:'#1160C4', hover:'#0D4E9F', mid:'#8FB6E8', soft:'#E8F0FC'},
       dark: {primary:'#5B9CF0', hover:'#8ABBF7', mid:'#2B5590', soft:'#122238'}},
      {k:'violet', label:'Violet',
       light:{primary:'#6A38C4', hover:'#572CA5', mid:'#B49BE6', soft:'#F0EAFC'},
       dark: {primary:'#A882F0', hover:'#C2A6F7', mid:'#4E3480', soft:'#1E1633'}},
      {k:'orange', label:'Warm Orange',
       light:{primary:'#C2560B', hover:'#A24709', mid:'#EDA97A', soft:'#FDEFE4'},
       dark: {primary:'#F08A45', hover:'#F5A870', mid:'#8A4A1E', soft:'#33200F'}},
      {k:'mono',   label:'Monochrome',
       light:{primary:'#2E3238', hover:'#191F28', mid:'#A8AEB6', soft:'#EEF0F2'},
       dark: {primary:'#D6D9DD', hover:'#F5F5F7', mid:'#5A6069', soft:'#1C1F24'}}
    ];
  },
  THEME_CHART_DEFAULT(){
    return {light:['#0072B2','#E69F00','#009E73','#CC79A7','#D55E00'],
            dark: ['#56B4E9','#F0B849','#34C99B','#E8A0C4','#F07A3C']};
  },

  // 저장된 설정 읽기. 없으면 기본값.
  themePrefs(){
    const S=this.state;
    return {
      appearance: S.appearance || 'system',
      preset: S.themeK || 'mint',
      custom: S.themeCustom || {}          // {primary, background, text, text2, c1, c2, c3}
    };
  },

  loadTheme(){
    let saved={};
    try{ saved=JSON.parse(localStorage.getItem('mysbizon.theme')||'{}')||{}; }catch(e){}
    // 저장값은 사람이 고칠 수 있는 곳(localStorage)에서 온다. 아는 값만 받는다 —
    // 예컨대 locale 에 숫자가 들어 있으면 사전을 못 찾아 화면이 반쯤 비어 보인다.
    const patch={};
    const okAppearance=['system','light','dark'];
    const okLocale=this.LOCALES().map(l=>l.k);
    const okPreset=this.THEME_PRESETS().map(p=>p.k);
    if(okAppearance.indexOf(saved.appearance)>=0) patch.appearance=saved.appearance;
    if(okPreset.indexOf(saved.preset)>=0) patch.themeK=saved.preset;
    if(saved.custom&&typeof saved.custom==='object'&&!Array.isArray(saved.custom)) patch.themeCustom=saved.custom;
    if(okLocale.indexOf(saved.locale)>=0) patch.locale=saved.locale;
    if(Object.keys(patch).length) this.setState(patch);
    // 걸러 낸 값(patch)만 쓴다 — saved 를 다시 끼워 넣으면 위 검사가 무의미해진다
    this.applyTheme(patch.appearance||'system', patch.themeK||'mint', patch.themeCustom||{});
    // system 을 고른 사람은 OS 설정이 바뀌면 화면도 바뀌어야 한다
    if(typeof matchMedia==='function'){
      const mq=matchMedia('(prefers-color-scheme: dark)');
      const on=()=>{ if((this.state.appearance||'system')==='system') this.applyTheme('system'); };
      if(mq.addEventListener) mq.addEventListener('change',on); else if(mq.addListener) mq.addListener(on);
      this._mq=mq; this._mqOn=on;
    }
  },

  saveTheme(){
    const p=this.themePrefs();
    try{
      localStorage.setItem('mysbizon.theme', JSON.stringify({
        appearance:p.appearance, preset:p.preset, custom:p.custom, locale:this.state.locale||'ko'}));
    }catch(e){}
  },

  // 실제로 <html> 에 값을 얹는 곳
  // 배경색 위에서 대비가 큰 글자색(흰색 또는 아주 어두운 먹색)을 고른다.
  // WCAG 상대휘도로 잰다 — 눈으로 고르면 프리셋마다 다시 틀린다.
  onPrimary(hex){
    const m=String(hex||'').trim().match(/^#?([0-9a-f]{6})$/i);
    if(!m) return '#FFFFFF';
    const v=m[1], ch=i=>parseInt(v.slice(i*2,i*2+2),16)/255;
    const f=x=> x<=0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4);
    const L=0.2126*f(ch(0))+0.7152*f(ch(1))+0.0722*f(ch(2));
    const white=1.05/(L+0.05);          // 흰 글자와의 대비
    const dark =(L+0.05)/(0.0223+0.05); // #052620 과의 대비
    const best=Math.max(white,dark);
    // 중간 회색(#7F7F7F)은 둘 다 4.5 를 못 넘는다 — 그때만 순백·순검으로 간다.
    // (직접 고른 색이라 미리 막을 수 없다. 보기보다 읽히는 쪽을 고른다.)
    if(best<4.5) return (1.05/(L+0.05)) >= ((L+0.05)/0.05) ? '#FFFFFF' : '#000000';
    return white>=dark ? '#FFFFFF' : '#052620';
  },

  // '글자로 쓰는 강조색'. 면 위 글자(--color-on-primary)와 다른 문제다 —
  // 강조색을 배경 위에 글자로 얹으면, 밝은 색을 고른 순간 안 보인다(형광 노랑 1.07:1).
  // 배경과 4.5:1 이 될 때까지 어둡게(또는 밝게) 옮긴 값을 돌려준다.
  // 기본 프리셋들은 이미 넘기므로 **그대로 돌아간다** — 화면이 바뀌지 않는다.
  readableOn(hex, bgHex){
    const rgb=t=>{ const m=String(t||'').trim().match(/^#?([0-9a-f]{6})$/i);
      return m? [0,1,2].map(i=>parseInt(m[1].slice(i*2,i*2+2),16)) : null; };
    const f=x=>{ const s=x/255; return s<=0.03928? s/12.92 : Math.pow((s+0.055)/1.055,2.4); };
    const lum=c=>0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);
    const a=rgb(hex), b=rgb(bgHex);
    if(!a||!b) return hex;
    const bl=lum(b);
    const ratio=c=>{ const l=lum(c); return (Math.max(l,bl)+0.05)/(Math.min(l,bl)+0.05); };
    if(ratio(a)>=4.5) return hex;
    const toward = bl>0.5 ? 0 : 255;              // 밝은 배경이면 어둡게, 어두우면 밝게
    let cur=a.slice();
    for(let i=0;i<20;i++){
      cur=cur.map(v=>Math.round(v+(toward-v)*0.12));
      if(ratio(cur)>=4.5) break;
    }
    return '#'+cur.map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('').toUpperCase();
  },

  applyTheme(appearance, presetK, custom){
    if(typeof document==='undefined') return;
    const root=document.documentElement;
    const p=this.themePrefs();
    const app = appearance || p.appearance;
    const key = presetK || p.preset;
    const cst = custom || p.custom;

    // ① 밝게/어둡게
    const dark = app==='dark' || (app==='system'
      && typeof matchMedia==='function' && matchMedia('(prefers-color-scheme: dark)').matches);
    if(dark) root.setAttribute('data-theme','dark');
    else root.removeAttribute('data-theme');

    // ② 프리셋 — 토큰만 덮어쓴다
    const preset=this.THEME_PRESETS().find(x=>x.k===key)||this.THEME_PRESETS()[0];
    const c=dark?preset.dark:preset.light;
    const set=(n,v)=>{ if(v) root.style.setProperty(n,v); else root.style.removeProperty(n); };
    set('--color-primary',c.primary);
    set('--color-primary-hover',c.hover);
    set('--color-primary-mid',c.mid);
    set('--color-primary-soft',c.soft);

    const chart=this.THEME_CHART_DEFAULT()[dark?'dark':'light'];
    set('--chart-series-1',chart[0]);
    set('--chart-series-2',chart[1]);
    set('--chart-series-3',chart[2]);

    // ③ 직접 설정이 있으면 그게 이긴다
    if(cst){
      if(cst.primary){ set('--color-primary',cst.primary); set('--color-primary-hover',cst.primary); }
      set('--color-background',cst.background);
      set('--color-text-primary',cst.text);
      set('--color-text-secondary',cst.text2);
      set('--chart-series-1',cst.c1);
      set('--chart-series-2',cst.c2);
      set('--chart-series-3',cst.c3);
    }
    // ④ 민트 면 위 글자색 — 흰 글자가 늘 옳은 게 아니다.
    //   어두운 화면의 기본 민트(#3FA88F)는 흰 글자와 2.91:1(AA 는 4.5:1 필요).
    //   프리셋·직접 설정으로 어떤 색이 와도 맞도록, 실제 색의 밝기를 재서 고른다.
    const primaryNow = (cst&&cst.primary) || c.primary;
    set('--color-on-primary', this.onPrimary(primaryNow) );
    // ⑤ 강조색을 '글자'로 쓸 때. 배경과 4.5:1 이 안 되면 그만큼만 옮긴다.
    const bgNow = (cst&&cst.background) || (dark?'#000000':'#FFFFFF');
    //   배경만 보면 모자란다 — 같은 글자가 회색 면(--surface)과 hover 면(--line) 위에도 앉는다.
    //   가장 진한 면까지 통과하도록 두 번 재운다(이미 넘으면 값이 그대로 돌아온다).
    const surfNow = dark ? '#26262B' : '#E5E8EB';
    set('--color-primary-text', this.readableOn(this.readableOn(primaryNow, bgNow), surfNow));

    // 차트는 CSS 변수를 직접 못 읽는다 — 다시 그리게 표시만 바꿔 준다
    this._theme = (dark?'dark':'light')+'/'+key+'/'+JSON.stringify(cst||{});
  },

  setAppearance(v){ this.setState({appearance:v}); this.applyTheme(v); this.saveTheme(); },
  setPreset(k){
    // 프리셋을 고르면 직접 설정의 primary 는 비운다 — 안 그러면 눌러도 안 바뀐다
    const cst={...(this.state.themeCustom||{})}; delete cst.primary;
    this.setState({themeK:k, themeCustom:cst});
    this.applyTheme(null,k,cst); this.saveTheme();
  },
  setCustom(field,v){
    const cst={...(this.state.themeCustom||{})};
    if(v) cst[field]=v; else delete cst[field];
    this.setState({themeCustom:cst});
    this.applyTheme(null,null,cst); this.saveTheme();
  },
  resetTheme(){
    this.setState({appearance:'system', themeK:'mint', themeCustom:{}});
    this.applyTheme('system','mint',{});
    this.saveTheme();
  }
};

// 헤더의 언어 칩 + 설정창(§44). 모바일에서는 아래에서 올라오는 시트로 뜬다.
globalThis.MysbizonParts.theme.settingsView = function(){
  const S=this.state, p=this.themePrefs();
  const cst=p.custom||{};
  const mobile=this.bp()==='mobile';

  const pill=on=>'flex:none;padding:8px 14px;border-radius:999px;font-size:13px;cursor:pointer;'
    +'white-space:nowrap;transition:background .14s,color .14s;'
    // 민트 면 위 글자색은 theme.js 가 휘도를 재서 정한다 — 흰 글자를 박으면
    // 어두운 화면에서 2.79:1(AA 4.5 미달)이 된다.
    +(on?'background:var(--color-primary);color:var(--on-accent);font-weight:600'
        :'background:var(--color-surface);color:var(--color-text-secondary)');

  const color=(field,label,fallback)=>({
    label, value:cst[field]||fallback,
    onIn:e=>this.setCustom(field, e.target.value),
    style:'width:44px;height:32px;padding:0;border:1px solid var(--color-border);'
      +'border-radius:8px;background:none;cursor:pointer'
  });

  // 고급 설정 — 개발자용 색 항목은 기본 화면에 내지 않는다(§12).
  const adv=!!S.setAdv;

  return {
    // 헤더 — ⚙ 하나만 둔다. 언어·밝기·테마는 전부 이 안으로 들어간다(§11).
    settingsOpen:!!S.setOpen,
    openSettings:()=>this.setState({setOpen:!S.setOpen}),
    closeSettings:()=>this.setState({setOpen:false, setAdv:false}),
    settingsBtn:'flex:none;width:40px;height:40px;border-radius:50%;display:inline-flex;'
      +'align-items:center;justify-content:center;cursor:pointer;font-size:15px;'
      +'background:var(--color-surface);color:var(--color-text-secondary)',
    // 시트/패널
    settingsCard: mobile
      ? 'position:fixed;left:0;right:0;bottom:0;z-index:80;background:var(--color-elevated);'
        +'border-radius:22px 22px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.24);padding:22px 20px 28px;'
        +'max-height:82vh;overflow-y:auto;animation:botIn .24s cubic-bezier(.22,.72,.24,1) both'
      : 'position:fixed;right:22px;top:66px;z-index:80;width:320px;background:var(--color-elevated);'
        +'border:1px solid var(--color-border);border-radius:20px;box-shadow:var(--shadow-pop);'
        +'padding:20px;max-height:calc(100vh - 96px);overflow-y:auto;'
        +'animation:riseIn .18s cubic-bezier(.22,.72,.24,1) both',
    settingsTitle:this.t('settings.title'),

    // 테마 — 색 동그라미 한 줄. 누르면 바로 바뀐다(3초 안에).
    themeLabel2:this.t('settings.theme'),
    presetName:(this.THEME_PRESETS().find(t=>t.k===p.preset)||this.THEME_PRESETS()[0]).label,
    presets:this.THEME_PRESETS().map(t=>{
      const on = p.preset===t.k && !cst.primary;
      return {
        label:t.label, pick:()=>this.setPreset(t.k),
        style:'flex:none;width:30px;height:30px;border-radius:50%;cursor:pointer;'
          +'background:'+(this.state.appearance==='dark'?t.dark.primary:t.light.primary)+';'
          +'box-shadow:0 0 0 2px var(--color-background), 0 0 0 '+(on?'4px':'0')+' var(--color-text-primary);'
          +'transition:box-shadow .16s'};
    }),
    customPrimary:color('primary', this.t('settings.custom'), '#087F6B'),

    appearanceLabel:this.t('settings.appearance'),
    appearances:[['light','settings.light'],['dark','settings.dark'],['system','settings.system']]
      .map(([k,tk])=>({label:this.t(tk), pick:()=>this.setAppearance(k), style:pill(p.appearance===k)})),

    languageLabel:this.t('settings.language'),
    locales:this.LOCALES().map(l=>({
      label:l.label, pick:()=>this.setLocale(l.k), style:pill(this.locale()===l.k)})),

    // 여기부터는 접어 둔다
    advOpen:adv,
    advLabel:this.t(adv?'settings.advClose':'settings.adv'),
    advToggle:()=>this.setState({setAdv:!adv}),
    customs:[
      color('background',this.t('settings.background'),     '#FFFFFF'),
      color('text',      this.t('settings.textPrimary'),    '#191F28'),
      color('text2',     this.t('settings.textSecondary'),  '#4E5968')
    ],
    chartLabel:this.t('settings.chartColors'),
    chartColors:[
      color('c1','1','#0072B2'), color('c2','2','#E69F00'), color('c3','3','#009E73')
    ],
    resetLabel:this.t('common.reset'),
    doReset:()=>this.resetTheme(),
    // 번역이 어디까지 됐는지 숨기지 않는다
    i18nNote: this.locale()==='ko' ? '' : this.t('settings.i18nNote')
  };
};
