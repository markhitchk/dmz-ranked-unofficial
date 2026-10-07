import * as Application from 'expo-application';
import bundledAppUi from '../../assets/dmz_app_ui.json';
import { isValidAppUiPayload } from './appUiInjection';

const CSS_URL =
  'https://raw.githubusercontent.com/markhitchk/dmz-ranked-unofficial/main/remote/app-ui/app.css';
const JS_URL =
  'https://raw.githubusercontent.com/markhitchk/dmz-ranked-unofficial/main/remote/app-ui/app.js';
const TIMEOUT_MS = 3500;

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const version = Application.nativeApplicationVersion ?? '1.0.65';
    const response = await fetch(`${url}?ts=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'text/plain',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        'User-Agent': `DMZRankedApp-RemoteUI/${version}`
      }
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const text = await response.text();
    if (!isValidAppUiPayload(text)) throw new Error('Invalid remote app UI payload');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadRemoteAppUi(): Promise<{ css: string; js: string }> {
  try {
    const [css, js] = await Promise.all([fetchText(CSS_URL), fetchText(JS_URL)]);
    return { css, js };
  } catch (error) {
    // Original app fallback: the main assets bundled with this APK, never an
    // old AsyncStorage override from another build. Freeze this pair per page.
    if (!isValidAppUiPayload(bundledAppUi.css) || !isValidAppUiPayload(bundledAppUi.js)) throw error;
    return bundledAppUi;
  }
}
