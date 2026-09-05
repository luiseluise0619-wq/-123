// Custom template controls have native-button keyboard behavior.
//
// 왜 즉시실행 함수(IIFE)로 감쌌나
//   dc-runtime 은 템플릿 안의 <script> 를 찾아 head 에 다시 붙인다(dc-runtime.js 의 SCRIPT| 처리).
//   그런데 이 파일은 index.html 의 head 에서 브라우저가 이미 한 번 실행한다.
//   그래서 같은 파일이 두 번 실행되는데, 예전처럼 최상위에 `let activeDialog` 을 두면
//   두 번째 실행이 "Identifier 'activeDialog' has already been declared" 로 통째로 죽었다.
//   먼저 실행된 쪽이 살아 있어 기능 자체는 돌았지만, 콘솔에 치명 오류가 남아
//   **진짜 오류를 가린다.** 함수 안으로 넣으면 재실행이 무해해진다.
//
//   추가로 __a11yBound 로 한 번만 붙게 막는다. IIFE 만 씌우면 재실행 때
//   MutationObserver 와 keydown 리스너가 하나씩 더 붙어, Esc 한 번에 닫기가
//   두 번 불리는 종류의 문제가 생긴다.
(function () {
  if (window.__a11yBound) return;
  window.__a11yBound = true;

  let activeDialog = null, previousFocus = null;
  const focusable = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';

  new MutationObserver(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (dialog === activeDialog) return;
    if (dialog) { previousFocus = document.activeElement; activeDialog = dialog; (dialog.querySelector(focusable) || dialog).focus(); }
    else { activeDialog = null; if (previousFocus?.isConnected) previousFocus.focus(); previousFocus = null; }
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('keydown', event => {
    if (activeDialog) {
      if (event.key === 'Escape') { event.preventDefault(); activeDialog.querySelector('[data-dialog-close]')?.click(); return; }
      if (event.key === 'Tab') {
        const items = [...activeDialog.querySelectorAll(focusable)].filter(e => e.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (!first) { event.preventDefault(); activeDialog.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    }
    const control = event.target.closest?.('[role="button"]');
    if (!control || event.target !== control || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); if (!event.repeat) control.click();
  });
})();
