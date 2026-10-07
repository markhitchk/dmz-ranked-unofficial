export const APP_UI_MARKER = 'DMZ Ranked Remote App UI v1';

export function isValidAppUiPayload(text: string): boolean {
  return text.length > 1000 && text.length <= 512 * 1024 && text.includes(APP_UI_MARKER);
}

// Sending JavaScript is not completion. Wait for the document's acknowledgement.
export function buildRemoteUiInjection(css: string, js: string, pageId: number): string {
  return `
(function () {
  var id = ${JSON.stringify(pageId)};
  var css = ${JSON.stringify(css)};
  var js = ${JSON.stringify(js)};
  var styleId = 'hs-remote-app-ui-style';
  var checks = 0;
  var done = false;
  var stable = false;
  var timer;
  if (window.__dmzRnCancelUiCheck) window.__dmzRnCancelUiCheck();
  window.__dmzRnCancelUiCheck = function () { done = true; clearTimeout(timer); };
  function send(type, message) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type: type, pageId: id, message: message}));
  }
  function fail(error) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    send('app-ui-error', String(error && error.message || error));
  }
  function ensureCss() {
    var style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
    window.__DMZ_APP_CSS_TEXT = css;
    return style;
  }
  function check() {
    if (done) return;
    try {
      var style = ensureCss();
      if (window.__dmzHsBetaTabsRefresh) window.__dmzHsBetaTabsRefresh();
      var ready = style.textContent.indexOf(${JSON.stringify(APP_UI_MARKER)}) >= 0 &&
        style.textContent.length > 1000 && style.sheet && style.sheet.cssRules.length > 0 &&
        document.documentElement.getAttribute('data-dmz-app-ui') === 'installed' &&
        document.documentElement.getAttribute('data-dmz-app-css') === 'active' &&
        typeof window.__dmzHsBetaTabsRefresh === 'function' && window.__hsAppQolInstalled &&
        document.querySelector('nav.tabs.hs-site-tabs [data-hs-unofficial-app]') &&
        document.getElementById('unofficial-app') && document.getElementById('dmz-hs-active-user-stats');
      // Check twice across a rendering interval to catch head/DOM rebuilds.
      if (ready && stable) {
        done = true;
        send('app-ui-ready');
        return;
      }
      stable = Boolean(ready);
      if (++checks >= 100) { fail('App interface did not become ready'); return; }
      timer = setTimeout(check, 120);
    } catch (error) { fail(error); }
  }
  try {
    if (css.length <= 1000 || css.indexOf(${JSON.stringify(APP_UI_MARKER)}) < 0 ||
        js.length <= 1000 || js.indexOf(${JSON.stringify(APP_UI_MARKER)}) < 0) {
      throw new Error('Invalid app interface payload');
    }
    ensureCss();
    if (!window.__dmzRnAppUiExecuted) {
      (0, eval)(js);
      window.__dmzRnAppUiExecuted = true;
    }
    document.documentElement.setAttribute('data-dmz-app-ui', 'installed');
    check();
  } catch (error) { fail(error); }
})();
true;`;
}
