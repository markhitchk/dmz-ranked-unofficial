import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import bundledAppUi from '../../assets/dmz_app_ui.json';
import {
  appUiPairRevision,
  isValidAppUiPair
} from './appUiInjection';

const REPO = 'markhitchk/dmz-ranked-unofficial';
const REMOTE_UI_BRANCH = 'react-native-migration';
const COMMIT_URL = `https://api.github.com/repos/${REPO}/commits/${REMOTE_UI_BRANCH}`;
const rawUrl = (revision: string, path: string) =>
  `https://raw.githubusercontent.com/${REPO}/${revision}/${path}`;
const TIMEOUT_MS = 3500;
const CACHE_KEY = 'dmz_remote_app_ui_pair_v2';

export type RemoteAppUiPayload = {
  css: string;
  js: string;
  source: 'remote' | 'cache' | 'bundled';
  updatedAt: number;
  revision: string;
};

type CachedPair = {
  css: string;
  js: string;
  updatedAt: number;
  revision: string;
};

async function fetchText(url: string, accept = 'text/plain'): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const version = Application.nativeApplicationVersion ?? '1.1.0';
    const response = await fetch(`${url}?ts=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: accept,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        'User-Agent': `DMZRankedApp-RemoteUI/${version}`
      }
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}


async function resolveRemoteRevision(): Promise<string> {
  const raw = await fetchText(COMMIT_URL, 'application/vnd.github+json');
  const parsed = JSON.parse(raw) as { sha?: unknown };
  const sha = String(parsed.sha ?? '').trim();
  if (!/^[a-f0-9]{40}$/i.test(sha)) {
    throw new Error('Could not resolve the latest App UI revision');
  }
  return sha;
}


async function readCachedPair(): Promise<RemoteAppUiPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedPair>;
    const css = String(cached.css ?? '');
    const js = String(cached.js ?? '');
    if (!isValidAppUiPair(css, js)) return null;
    return {
      css,
      js,
      source: 'cache',
      updatedAt: Number(cached.updatedAt) || 0,
      revision:
        typeof cached.revision === 'string' &&
        /^[a-f0-9]{40}$/i.test(cached.revision)
          ? cached.revision
          : appUiPairRevision(css, js)
    };
  } catch {
    return null;
  }
}

async function storeRemotePair(
  css: string,
  js: string,
  revision: string
): Promise<RemoteAppUiPayload> {
  if (!isValidAppUiPair(css, js)) {
    throw new Error('Remote app UI pair did not validate');
  }

  const updatedAt = Date.now();
  const safeRevision =
    /^[a-f0-9]{40}$/i.test(revision) ? revision : appUiPairRevision(css, js);
  const cached: CachedPair = {
    css,
    js,
    updatedAt,
    revision: safeRevision
  };

  // One JSON write makes CSS + JS atomic from the app's point of view. A failed
  // download can never replace only one half of the last-known-good pair.
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached));

  return {
    css,
    js,
    source: 'remote',
    updatedAt,
    revision: safeRevision
  };
}

export async function loadRemoteAppUi(): Promise<RemoteAppUiPayload> {
  try {
    // Resolve main once, then fetch both payloads from that immutable commit.
    // This prevents a branch update between the CSS and JS requests from ever
    // producing a mixed pair.
    const revision = await resolveRemoteRevision();
    const [css, js] = await Promise.all([
      fetchText(rawUrl(revision, 'remote/app-ui/app.css')),
      fetchText(rawUrl(revision, 'remote/app-ui/app.js'))
    ]);
    return await storeRemotePair(css, js, revision);
  } catch (remoteError) {
    const cached = await readCachedPair();
    if (cached) return cached;

    const css = String(bundledAppUi.css ?? '');
    const js = String(bundledAppUi.js ?? '');
    if (!isValidAppUiPair(css, js)) throw remoteError;

    return {
      css,
      js,
      source: 'bundled',
      updatedAt: 0,
      revision: appUiPairRevision(css, js)
    };
  }
}
