const browser = {};
for (const g of ['window','document','console','fetch','URL','URLSearchParams','setTimeout','clearTimeout','setInterval','clearInterval','localStorage','sessionStorage','navigator','location','requestAnimationFrame','cancelAnimationFrame','Intl','globalThis','performance','Blob','FileReader','Image','CustomEvent','Event','MutationObserver','ResizeObserver','getComputedStyle','matchMedia','history','alert','atob','btoa','TextEncoder','TextDecoder','AbortController','structuredClone','queueMicrotask','DCLogic','MysbizonParts','MysbizonLogic','React','ReactDOM','process','module','require','exports','__dirname','Buffer']) browser[g]='readonly';
export default [
  { files: ['**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: browser },
    rules: { 'no-undef': 'error' } },
];
