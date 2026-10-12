import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Read-only, on-device snapshot of public content the existing WebView has
 * already rendered. This module NEVER contacts the website or its backend.
 */
export type CachedStandingRow = {
  id: string;
  name: string;
  position: string;
  rank: string;
  sr: string;
  raids: string;
};

export type PublicLeaderboardSnapshot = {
  version: 1;
  capturedAt: number;
  sourceUrl: string;
  season: string;
  standings: string[];
  boardRows: CachedStandingRow[];
  hallOfFame: string[];
  leaders: string[];
  awardStandings: string[];
  medals: string[];
  counters: Record<string, string>;
};

const CACHE_KEY = 'dmz_public_leaderboard_snapshot_v1';
const MAX_ROWS = 100;
const MAX_BOARD_ROWS = 70;
export const MAX_HYDRATION_AGE_MS = 12 * 60 * 60 * 1000;
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

function parseBoardRows(value: unknown): CachedStandingRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_BOARD_ROWS).flatMap((raw): CachedStandingRow[] => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const id = cleanText(row.id, 120);
    const name = cleanText(row.name, 90);
    const sr = cleanText(row.sr, 35);
    if (!id || !name || !sr) return [];
    return [{
      id, name, sr,
      position: cleanText(row.position, 10),
      rank: cleanText(row.rank, 75),
      raids: cleanText(row.raids, 90)
    }];
  });
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
  const boardRows = parseBoardRows(raw.boardRows);
  const hallOfFame = rows(raw.hallOfFame);
  const leaders = rows(raw.leaders);
  const awardStandings = rows(raw.awardStandings);
  const medals = rows(raw.medals);
  // A bare count during website hydration is not a usable leaderboard.
  if (!standings.length && !hallOfFame.length && !leaders.length &&
      !awardStandings.length && !medals.length) return null;

  const now = Date.now();
  const stamp = useStoredTimestamp ? Number(raw.capturedAt) : now;
  if (!Number.isFinite(stamp) || stamp > now + 60_000 ||
      stamp < now - MAX_AGE_MS) return null;

  return {
    version: 1, capturedAt: stamp, sourceUrl,
    season: cleanText(raw.season, 120),
    standings, boardRows, hallOfFame, leaders, awardStandings, medals, counters
  };
}

function contentKey(snapshot: PublicLeaderboardSnapshot): string {
  return JSON.stringify([
    snapshot.sourceUrl, snapshot.season, snapshot.standings, snapshot.boardRows,
    snapshot.hallOfFame, snapshot.leaders, snapshot.awardStandings,
    snapshot.medals, snapshot.counters
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
  // Do not discard a populated board when a different page only renders its
  // leaders panel. Treat a season transition as a fresh snapshot instead.
  const previous = lastWritten;
  if (previous && snapshot.season === previous.season &&
      snapshot.sourceUrl === previous.sourceUrl) {
    // Individual website tabs render at different times. Do not erase an
    // already captured panel because that tab has not been mounted yet.
    if (!snapshot.standings.length) {
      snapshot.standings = previous.standings;
      snapshot.boardRows = previous.boardRows;
    }
    if (!snapshot.boardRows.length && snapshot.standings.length ===
        previous.standings.length && snapshot.standings.every(
          (row, i) => row === previous.standings[i]
        )) snapshot.boardRows = previous.boardRows;
    if (!snapshot.hallOfFame.length) snapshot.hallOfFame = previous.hallOfFame;
    if (!snapshot.leaders.length) snapshot.leaders = previous.leaders;
    if (!snapshot.awardStandings.length) snapshot.awardStandings = previous.awardStandings;
    if (!snapshot.medals.length) snapshot.medals = previous.medals;
  }

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
  const sections = snapshot.standings.length + snapshot.hallOfFame.length +
    snapshot.leaders.length + snapshot.awardStandings.length + snapshot.medals.length;
  const saved = Math.max(0, Math.floor((Date.now() - snapshot.capturedAt) / 60_000));
  return `Saved snapshot • ${sections} rows • ${saved < 1 ? 'just now' : saved + 'm ago'}`;
}
