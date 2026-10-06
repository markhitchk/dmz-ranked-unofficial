import AsyncStorage from '@react-native-async-storage/async-storage';

const CSS_URL =
  'https://raw.githubusercontent.com/markhitchk/dmz-ranked-unofficial/main/remote/app-ui/app.css';
const JS_URL =
  'https://raw.githubusercontent.com/markhitchk/dmz-ranked-unofficial/main/remote/app-ui/app.js';

const CACHE_CSS = 'dmz_remote_app_ui_css_v1';
const CACHE_JS = 'dmz_remote_app_ui_js_v1';
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 4500;

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'text/plain' }
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    const text = await response.text();
    if (text.length > MAX_BYTES) {
      throw new Error('Remote app UI payload is too large');
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadRemoteAppUi(): Promise<{ css: string; js: string }> {
  try {
    const [css, js] = await Promise.all([fetchText(CSS_URL), fetchText(JS_URL)]);
    await AsyncStorage.multiSet([
      [CACHE_CSS, css],
      [CACHE_JS, js]
    ]);
    return { css, js };
  } catch (error) {
    const cached = await AsyncStorage.multiGet([CACHE_CSS, CACHE_JS]);
    const css = cached[0]?.[1] ?? '';
    const js = cached[1]?.[1] ?? '';
    if (!css || !js) throw error;
    return { css, js };
  }
}

export function buildRemoteUiInjection(css: string, js: string): string {
  return [
    '(function () {',
    "  var styleId = 'hs-dmz-rn-app-css';",
    '  var oldStyle = document.getElementById(styleId);',
    '  if (oldStyle) oldStyle.remove();',
    "  var style = document.createElement('style');",
    '  style.id = styleId;',
    '  style.textContent = ' + JSON.stringify(css) + ';',
    '  document.head.appendChild(style);',
    '  try {',
    '    (0, eval)(' + JSON.stringify(js) + ');',
    '  } catch (error) {',
    "    if (window.HarleysStudiosApp && window.HarleysStudiosApp.log) window.HarleysStudiosApp.log('Remote UI JS failed: ' + error);",
    '  }',
    '  if (window.__dmzRnReadOperator) window.__dmzRnReadOperator();',
    '  return true;',
    '})();',
    'true;'
  ].join('\n');
}
