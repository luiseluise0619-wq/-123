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
    const patch={};
    if(saved.appearance) patch.appearance=saved.appearance;
    if(saved.preset) patch.themeK=saved.preset;
    if(saved.custom&&typeof saved.custom==='object') patch.themeCustom=saved.custom;
    if(saved.locale) patch.locale=saved.locale;
    if(Object.keys(patch).length) this.setState(patch);
    this.applyTheme(patch.appearance||saved.appearance||'system',
                    patch.themeK||saved.preset||'mint',
                    patch.themeCustom||saved.custom||{});
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
  const cur=this.LOCALES().find(l=>l.k===this.locale())||this.LOCALES()[0];

  const pill=on=>'flex:none;padding:8px 14px;border-radius:999px;font-size:13px;cursor:pointer;'
    +'white-space:nowrap;transition:background .14s,color .14s;'
    +(on?'background:var(--color-primary);color:#FFFFFF;font-weight:600'
        :'background:var(--color-surface);color:var(--color-text-secondary)');

  const color=(field,label,fallback)=>({
    label, value:cst[field]||fallback,
    onIn:e=>this.setCustom(field, e.target.value),
    style:'width:44px;height:32px;padding:0;border:1px solid var(--color-border);'
      +'border-radius:8px;background:none;cursor:pointer'
  });

  return {
    // 헤더
    localeShort:cur.short,
    settingsOpen:!!S.setOpen,
    openSettings:()=>this.setState({setOpen:!S.setOpen}),
    closeSettings:()=>this.setState({setOpen:false}),
    settingsBtn:'flex:none;width:34px;height:34px;border-radius:50%;display:inline-flex;'
      +'align-items:center;justify-content:center;cursor:pointer;font-size:15px;'
      +'background:var(--color-surface);color:var(--color-text-secondary)',
    localeBtn:'flex:none;padding:7px 12px;border-radius:999px;font-size:12.5px;font-weight:600;'
      +'cursor:pointer;white-space:nowrap;background:var(--color-surface);color:var(--color-text-secondary)',
    // 시트/패널
    settingsCard: mobile
      ? 'position:fixed;left:0;right:0;bottom:0;z-index:80;background:var(--color-background);'
        +'border-radius:22px 22px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.24);padding:22px 20px 28px;'
        +'max-height:82vh;overflow-y:auto;animation:botIn .24s cubic-bezier(.22,.72,.24,1) both'
      : 'position:fixed;right:22px;top:66px;z-index:80;width:340px;background:var(--color-background);'
        +'border:1px solid var(--color-border);border-radius:20px;box-shadow:var(--shadow-pop);'
        +'padding:20px;max-height:calc(100vh - 96px);overflow-y:auto;'
        +'animation:riseIn .18s cubic-bezier(.22,.72,.24,1) both',
    settingsTitle:this.t('settings.title'),

    appearanceLabel:this.t('settings.appearance'),
    appearances:[['light','settings.light'],['dark','settings.dark'],['system','settings.system']]
      .map(([k,tk])=>({label:this.t(tk), pick:()=>this.setAppearance(k), style:pill(p.appearance===k)})),

    languageLabel:this.t('settings.language'),
    locales:this.LOCALES().map(l=>({
      label:l.label, pick:()=>this.setLocale(l.k), style:pill(this.locale()===l.k)})),

    themeLabel2:this.t('settings.theme'),
    presets:this.THEME_PRESETS().map(t=>({
      label:t.label, pick:()=>this.setPreset(t.k),
      swatch:'flex:none;width:14px;height:14px;border-radius:50%;background:'
        +(this.state.appearance==='dark'?t.dark.primary:t.light.primary),
      style:'display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:var(--r-sm);'
        +'cursor:pointer;font-size:14px;transition:background .14s;'
        +(p.preset===t.k&&!cst.primary
          ? 'background:var(--color-primary-soft);color:var(--color-primary);font-weight:600'
          : 'background:var(--color-surface);color:var(--color-text-secondary)')})),

    customLabel:this.t('settings.custom'),
    customs:[
      color('primary',   this.t('settings.primary'),        '#087F6B'),
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
