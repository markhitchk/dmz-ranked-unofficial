export const APP_UI_MARKER = 'DMZ Ranked Remote App UI v1';

const APP_UI_MIN_CHARS = 1000;
const APP_UI_MAX_CHARS = 512 * 1024;

const IOS_SUPPORT_ENHANCEMENT_CSS = "#hs-ios-support-overlay .hs-ios-support-icon.hs-ios-support-branded{\n  width:118px!important;\n  min-width:118px;\n  height:60px!important;\n  padding:5px 8px!important;\n  gap:8px;\n  display:flex!important;\n  align-items:center;\n  justify-content:center;\n}\n#hs-ios-support-overlay .hs-ios-support-icon.hs-ios-support-branded img{\n  display:block;\n  width:46px;\n  height:46px;\n  object-fit:contain;\n}\n#hs-ios-support-overlay .hs-ios-support-icon.hs-ios-support-branded img[data-hs-studio-logo]{\n  width:48px;\n  height:48px;\n}\n#unofficial-app #hs-ios-support-app-card{\n  overflow:hidden;\n  border-top-color:rgba(230,169,43,.58);\n  background:\n    radial-gradient(90% 150% at 100% 0%,rgba(230,169,43,.13),transparent 62%),\n    var(--panel,rgba(17,23,25,.86));\n}\n#unofficial-app #hs-ios-support-app-card .hs-ios-support-app-head{\n  display:flex;\n  align-items:center;\n  gap:12px;\n  margin-bottom:10px;\n}\n#unofficial-app #hs-ios-support-app-card .hs-ios-support-app-logos{\n  flex:0 0 auto;\n  display:flex;\n  align-items:center;\n  gap:5px;\n  padding:5px 7px;\n  border:1px solid rgba(230,169,43,.28);\n  border-radius:10px;\n  background:rgba(0,0,0,.24);\n}\n#unofficial-app #hs-ios-support-app-card .hs-ios-support-app-logos img{\n  width:38px;\n  height:38px;\n  object-fit:contain;\n}\n#unofficial-app #hs-ios-support-app-card .hs-ios-support-app-copy{\n  margin:0 0 10px;\n  color:var(--muted,#9aa39b);\n  font-family:var(--f-ui,'Rajdhani',system-ui,sans-serif);\n  font-size:12.5px;\n  line-height:1.5;\n}\n#unofficial-app #hs-ios-support-app-card .hs-ios-support-app-note{\n  margin:0 0 12px;\n  padding:9px 10px;\n  border-left:3px solid var(--gold,#e6a92b);\n  border-radius:0 8px 8px 0;\n  background:rgba(230,169,43,.08);\n  color:var(--muted,#9aa39b);\n  font-size:11px;\n  line-height:1.45;\n}\n#unofficial-app #hs-ios-support-app-card .hs-ios-support-app-note b{\n  color:var(--txt,#e9ede9);\n}\n#unofficial-app #hs-ios-support-app-card .hs-ios-support-app-action{\n  min-height:42px;\n}\n@media(max-width:560px){\n  #hs-ios-support-overlay .hs-ios-support-icon.hs-ios-support-branded{\n    width:108px!important;\n    min-width:108px;\n    height:54px!important;\n  }\n  #hs-ios-support-overlay .hs-ios-support-icon.hs-ios-support-branded img{\n    width:40px;\n    height:40px;\n  }\n  #unofficial-app #hs-ios-support-app-card .hs-ios-support-app-head{\n    align-items:flex-start;\n  }\n  #unofficial-app #hs-ios-support-app-card .hs-ios-support-app-logos img{\n    width:34px;\n    height:34px;\n  }\n}";

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
  var iosCampaignStyleId = 'hs-rn-ios-support-style';
  var iosCampaignCss = ${JSON.stringify(IOS_SUPPORT_ENHANCEMENT_CSS)};
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


  function setCampaignLogo(image, source) {
    if (!image) return;
    if (!source) {
      image.style.display = 'none';
      image.removeAttribute('src');
      return;
    }
    if (image.getAttribute('src') !== source) image.setAttribute('src', source);
    image.style.display = 'block';
  }

  function ensureIosSupportEnhancements() {
    try {
      var info = window.__DMZ_APP_INFO || {};
      var dmzLogo = String(info.logoUrl || '');
      var studioLogo = String(info.studioLogoUrl || '');

      var campaignStyle = document.getElementById(iosCampaignStyleId);
      if (!campaignStyle) {
        campaignStyle = document.createElement('style');
        campaignStyle.id = iosCampaignStyleId;
        (document.head || document.documentElement).appendChild(campaignStyle);
      }
      if (campaignStyle.textContent !== iosCampaignCss) {
        campaignStyle.textContent = iosCampaignCss;
      }

      var popupBrand = document.querySelector('#hs-ios-support-overlay .hs-ios-support-icon');
      if (popupBrand) {
        popupBrand.classList.add('hs-ios-support-branded');
        var popupDmz = popupBrand.querySelector('[data-hs-dmz-logo]');
        if (!popupDmz) {
          popupBrand.textContent = '';
          popupDmz = document.createElement('img');
          popupDmz.setAttribute('data-hs-dmz-logo', '1');
          popupDmz.alt = '';
          popupBrand.appendChild(popupDmz);

          var popupStudio = document.createElement('img');
          popupStudio.setAttribute('data-hs-studio-logo', '1');
          popupStudio.alt = '';
          popupBrand.appendChild(popupStudio);
        }
        setCampaignLogo(popupDmz, dmzLogo);
        setCampaignLogo(
          popupBrand.querySelector('[data-hs-studio-logo]'),
          studioLogo
        );
      }

      var appPage = document.getElementById('unofficial-app');
      if (!appPage) return;

      var card = document.getElementById('hs-ios-support-app-card');
      if (!card) {
        card = document.createElement('div');
        card.id = 'hs-ios-support-app-card';
        card.className = 'card hs-ios-support-app-card';
        card.innerHTML =
          "<div class='hs-ios-support-app-head'>" +
            "<div class='hs-ios-support-app-logos' aria-hidden='true'>" +
              "<img data-hs-dmz-logo='1' alt=''>" +
              "<img data-hs-studio-logo='1' alt=''>" +
            "</div>" +
            "<div><div class='hs-app-eyebrow'>Harley's Studios · iOS expansion</div>" +
            "<h2 class='section-title'>Help bring DMZ Ranked to iOS</h2></div>" +
          "</div>" +
          "<p class='hs-ios-support-app-copy'>We want to bring the unofficial DMZ Ranked App to <b>iPhone and iPad</b>. Voluntary support helps cover Apple development, testing, and publishing costs while Android development continues.</p>" +
          "<div class='hs-ios-support-app-note'><b>Android is staying.</b> This campaign is only to help expand the app to Apple devices. Donations are voluntary and do not guarantee a release date.</div>" +
          "<button type='button' class='hs-app-action-btn hs-ios-support-app-action'>Support the iOS release</button>";

        var features = appPage.querySelector('.hs-app-features-card');
        var about = appPage.querySelector('.hs-app-about');
        var anchor = features || about;
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor);
        else appPage.appendChild(card);

        var action = card.querySelector('.hs-ios-support-app-action');
        if (action) {
          action.addEventListener('click', function () {
            try {
              window.location.href =
                'dmzranked-support://open?url=' +
                encodeURIComponent('https://ko-fi.com/harleytg_#checkoutModal');
            } catch (_) {}
          });
        }
      }

      setCampaignLogo(card.querySelector('[data-hs-dmz-logo]'), dmzLogo);
      setCampaignLogo(card.querySelector('[data-hs-studio-logo]'), studioLogo);

      var buildBadge = appPage.querySelector('.hs-app-update-build');
      var versionName = String(info.versionName || '');
      var versionCode = String(info.versionCode || '');
      if (buildBadge && versionName) {
        buildBadge.textContent =
          versionName + (versionCode ? ' · ' + versionCode : '');
      }
    } catch (_) {}
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

  function ensureActive() {
    var style = ensureCss();
    executeAppUiIfNeeded();
    document.documentElement.setAttribute('data-dmz-app-ui', 'installed');
    document.documentElement.setAttribute('data-dmz-app-css', 'active');
    refreshAppDom();
    ensureIosSupportEnhancements();
    return style;
  }

  window.__dmzRnRevalidateAppUi = function () {
    try {
      ensureActive();
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

    var scheduled = false;
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(function () {
        scheduled = false;
        try { ensureActive(); } catch (_) {}
      }, 120);
    }

    try {
      window.__dmzRnUiObserver = new MutationObserver(schedule);
      window.__dmzRnUiObserver.observe(
        document.documentElement || document.body,
        { subtree: true, childList: true }
      );
    } catch (_) {}

    window.__dmzRnUiWatchdogTimer = setInterval(function () {
      try { ensureActive(); } catch (_) {}
    }, 1600);
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
      var style = ensureActive();
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
    ensureActive();
    check();
  } catch (error) {
    fail(error);
  }
})();
true;`;
}
