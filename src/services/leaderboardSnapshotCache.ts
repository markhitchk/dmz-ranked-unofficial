import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Read-only, on-device snapshot of public content the existing WebView has
 * already rendered. This module NEVER contacts the website or its backend.
 */
export type PublicLeaderboardSnapshot = {
  version: 1;
  capturedAt: number;
  sourceUrl: string;
  season: string;
  standings: string[];
  hallOfFame: string[];
  leaders: string[];
  counters: Record<string, string>;
};

const CACHE_KEY = 'dmz_public_leaderboard_snapshot_v1';
const MAX_ROWS = 100;
const MAX_COUNTERS = 36;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
let lastWritten: PublicLeaderboardSnapshot | null = null;

function cleanText(value: unknown, maxLength = 180): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function internalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !(
      url.hostname === 'dmzranked.com' || url.hostname.endsWith('.dmzranked.com')
    )) return null;
    return url.origin + url.pathname;
  } catch {
    return null;
  }
}

function rows(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ROWS)
    .map(row => cleanText(row, 220))
    .filter(row => row.length > 0 && !/^(loading|connecting|syncing|—|-)\b/i.test(row));
}

function normalize(value: unknown, useStoredTimestamp: boolean): PublicLeaderboardSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const sourceUrl = internalUrl(raw.sourceUrl);
  if (!sourceUrl) return null;

  const rawCounters = raw.counters;
  const counters: Record<string, string> = {};
  if (rawCounters && typeof rawCounters === 'object' && !Array.isArray(rawCounters)) {
    for (const [key, value] of Object.entries(rawCounters).slice(0, MAX_COUNTERS)) {
      const label = cleanText(key, 65);
      const text = cleanText(value, 140);
      if (label && text && !/^(loading|connecting|syncing|—|-)$/i.test(text)) {
        counters[label] = text;
      }
    }
  }

  const standings = rows(raw.standings);
  const hallOfFame = rows(raw.hallOfFame);
  const leaders = rows(raw.leaders);
  if (!standings.length && !hallOfFame.length && !leaders.length &&
      !Object.keys(counters).length) return null;

  const now = Date.now();
  const stamp = useStoredTimestamp ? Number(raw.capturedAt) : now;
  if (!Number.isFinite(stamp) || stamp > now + 60_000 ||
      stamp < now - MAX_AGE_MS) return null;

  return {
    version: 1, capturedAt: stamp, sourceUrl,
    season: cleanText(raw.season, 120),
    standings, hallOfFame, leaders, counters
  };
}

function contentKey(snapshot: PublicLeaderboardSnapshot): string {
  return JSON.stringify([
    snapshot.sourceUrl, snapshot.season, snapshot.standings,
    snapshot.hallOfFame, snapshot.leaders, snapshot.counters
  ]);
}

export async function loadLeaderboardSnapshot(): Promise<PublicLeaderboardSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version !== 1) return null;
    const result = normalize(parsed, true);
    lastWritten = result;
    return result;
  } catch {
    return null;
  }
}

export async function saveLeaderboardSnapshot(
  value: unknown
): Promise<PublicLeaderboardSnapshot | null> {
  const snapshot = normalize(value, false);
  if (!snapshot) return null;

  // Ignore identical observations except for a periodic freshness renewal.
  if (lastWritten && contentKey(lastWritten) === contentKey(snapshot) &&
      snapshot.capturedAt - lastWritten.capturedAt < 5 * 60_000) {
    return lastWritten;
  }
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  lastWritten = snapshot;
  return snapshot;
}

export async function clearLeaderboardSnapshot(): Promise<void> {
  lastWritten = null;
  await AsyncStorage.removeItem(CACHE_KEY);
}

export function describeCachedSnapshot(snapshot: PublicLeaderboardSnapshot): string {
  const sections = snapshot.standings.length + snapshot.hallOfFame.length + snapshot.leaders.length;
  const saved = Math.max(0, Math.floor((Date.now() - snapshot.capturedAt) / 60_000));
  return `Saved snapshot • ${sections} rows • ${saved < 1 ? 'just now' : saved + 'm ago'}`;
}
