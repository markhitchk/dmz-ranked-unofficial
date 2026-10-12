export const APP_UI_MARKER = 'DMZ Ranked Remote App UI v1';

const APP_UI_MIN_CHARS = 1000;
const APP_UI_MAX_CHARS = 512 * 1024;

export function isValidAppUiPayload(text: string): boolean {
  return (
    text.length > APP_UI_MIN_CHARS &&
    text.length <= APP_UI_MAX_CHARS &&
    text.includes(APP_UI_MARKER)
  );
}

function payloadRevision(text: string): string {
  const match = text.match(/DMZ Ranked Remote App UI v(\d+)/i);
  return match ? `v${match[1]}` : '';
}

export function isValidAppUiPair(css: string, js: string): boolean {
  const cssRevision = payloadRevision(css);
  const jsRevision = payloadRevision(js);
  return (
    isValidAppUiPayload(css) &&
    isValidAppUiPayload(js) &&
    Boolean(cssRevision) &&
    cssRevision === jsRevision
  );
}

export function appUiPairRevision(css: string, js: string): string {
  return isValidAppUiPair(css, js) ? payloadRevision(css) : '';
}

// Sending JavaScript is not completion. Wait for the document's acknowledgement,
// then keep a lightweight watchdog alive for SPA/head rebuilds.
export function buildRemoteUiInjection(
  css: string,
  js: string,
  pageId: number,
  revision = appUiPairRevision(css, js)
): string {
  return `
(function () {
  var id = ${JSON.stringify(pageId)};
  var css = ${JSON.stringify(css)};
  var js = ${JSON.stringify(js)};
  var revision = ${JSON.stringify(revision)};
  var styleId = 'hs-remote-app-ui-style';
  var checks = 0;
  var done = false;
  var stable = false;
  var timer;
  var watchdogTimer;
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

  function executeAppUiIfNeeded() {
    var missing =
      typeof window.__dmzHsBetaTabsRefresh !== 'function' ||
      !window.__hsAppQolInstalled;
    if (!window.__dmzRnAppUiExecuted || missing) {
      (0, eval)(js);
      window.__dmzRnAppUiExecuted = true;
      window.__dmzRnAppUiRevision = revision;
    }
  }

  function refreshAppDom() {
    try {
      if (typeof window.__dmzHsBetaTabsRefresh === 'function') {
        window.__dmzHsBetaTabsRefresh();
      }
    } catch (_) {}
    try {
      if (typeof window.__dmzHsUpdateMessage === 'function') {
        window.__dmzHsUpdateMessage();
      }
    } catch (_) {}
    try {
      if (typeof window.__dmzRnRefreshOperatorLifecycle === 'function') {
        window.__dmzRnRefreshOperatorLifecycle();
      }
    } catch (_) {}
  }

  // Avoid refreshing every app DOM control for every unrelated mutation.
  function ensureActive(refreshDom) {
    var style = ensureCss();
    executeAppUiIfNeeded();
    document.documentElement.setAttribute('data-dmz-app-ui', 'installed');
    document.documentElement.setAttribute('data-dmz-app-css', 'active');
    if (refreshDom) refreshAppDom();
    return style;
  }

  function needsRepair() {
    var style = document.getElementById(styleId);
    return !style ||
      style.textContent.length !== css.length ||
      typeof window.__dmzHsBetaTabsRefresh !== 'function' ||
      !window.__hsAppQolInstalled ||
      !document.querySelector('nav.tabs.hs-site-tabs [data-hs-unofficial-app]') ||
      !document.getElementById('unofficial-app') ||
      !document.getElementById('dmz-hs-active-user-stats');
  }

  window.__dmzRnRevalidateAppUi = function () {
    try {
      ensureActive(true);
      return true;
    } catch (_) {
      return false;
    }
  };

  function installWatchdog() {
    if (window.__dmzRnUiObserver) {
      try { window.__dmzRnUiObserver.disconnect(); } catch (_) {}
    }
    if (window.__dmzRnUiWatchdogTimer) {
      clearInterval(window.__dmzRnUiWatchdogTimer);
    }

    // Delay repairs until scrolling settles instead of repeatedly touching
    // the page DOM during rapid touch and scroll events.
    var scheduled = false;
    function schedule() {
      // Ignore high-volume DOM changes while dragging/scrolling. A slower
      // watchdog and the foreground revalidator still repair missing CSS.
      if (scheduled || window.__dmzAppScrolling || window.__dmzAppPaused) return;
      scheduled = true;
      clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(function () {
        scheduled = false;
        if (window.__dmzAppScrolling || window.__dmzAppPaused) return;
        try {
          if (needsRepair()) ensureActive(true);
        } catch (_) {}
      }, 850);
    }

    try {
      // Only watch App UI anchors. Watching the complete page causes a
      // MutationObserver callback for every live leaderboard redraw and
      // competes with WebView's raster/compositor work on fast flings.
      window.__dmzRnUiObserver = new MutationObserver(schedule);
      var observer = window.__dmzRnUiObserver;
      if (document.head) {
        observer.observe(document.head, { childList: true });
      }
      var nav = document.querySelector('nav.tabs');
      if (nav) observer.observe(nav, { childList: true });
      if (nav && nav.parentElement) {
        observer.observe(nav.parentElement, { childList: true });
      }
      var app = document.getElementById('unofficial-app');
      if (app) observer.observe(app, { childList: true });
      if (app && app.parentElement && app.parentElement !== nav?.parentElement) {
        observer.observe(app.parentElement, { childList: true });
      }
      // If the site's top-level page shell is replaced, the 8-second
      // watchdog (and foreground revalidation) will restore the App UI.
    } catch (_) {}

    // Recovery watchdog is intentionally slow and only repairs broken UI.
    window.__dmzRnUiWatchdogTimer = setInterval(function () {
      if (window.__dmzAppScrolling || window.__dmzAppPaused) return;
      try {
        if (needsRepair()) ensureActive(true);
        else ensureCss();
      } catch (_) {}
    }, 8000);
  }

  function readyState(style) {
    return (
      style &&
      style.textContent.indexOf(${JSON.stringify(APP_UI_MARKER)}) >= 0 &&
      style.textContent.length > ${APP_UI_MIN_CHARS} &&
      style.sheet &&
      style.sheet.cssRules.length > 0 &&
      document.documentElement.getAttribute('data-dmz-app-ui') === 'installed' &&
      document.documentElement.getAttribute('data-dmz-app-css') === 'active' &&
      typeof window.__dmzHsBetaTabsRefresh === 'function' &&
      window.__hsAppQolInstalled &&
      document.querySelector('nav.tabs.hs-site-tabs [data-hs-unofficial-app]') &&
      document.getElementById('unofficial-app') &&
      document.getElementById('dmz-hs-active-user-stats')
    );
  }

  function check() {
    if (done) return;
    try {
      // Do not run all of the expensive app DOM refresh functions on every
      // 120ms readiness poll. Reattempt them only occasionally if incomplete.
      var style = ensureActive(checks % 6 === 0);
      var ready = readyState(style);
      if (ready && stable) {
        done = true;
        installWatchdog();
        send('app-ui-ready');
        return;
      }
      stable = Boolean(ready);
      if (++checks >= 100) {
        fail('App interface did not become ready');
        return;
      }
      timer = setTimeout(check, 120);
    } catch (error) {
      fail(error);
    }
  }

  try {
    if (!${JSON.stringify(isValidAppUiPair(css, js))}) {
      throw new Error('Invalid or mismatched app interface payload pair');
    }
    ensureActive(true);
    check();
  } catch (error) {
    fail(error);
  }
})();
true;`;
}
