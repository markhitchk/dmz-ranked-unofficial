import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { loadSettings } from './storage';
import { showWebsiteNotification } from './notifications';

const TASK_NAME = 'dmz-ranked-background-notification-sync';
const PUBLIC_STATE_URL = 'https://dmzranked.com/api/v1/data/public-state';

const KEY_BASELINE = 'dmz_notification_sync_baseline_v1';
const KEY_SEASON = 'dmz_notification_sync_season_v1';
const KEY_LAST_SYNC = 'dmz_notification_sync_last_v1';
const KEY_APP_FOREGROUND = 'dmz_notification_app_foreground_v1';
const KEY_HANDLED_RAID_REPORT = 'dmz_notification_handled_raid_report_v1';
const KEY_HANDLED_OPERATOR_REPORT = 'dmz_notification_handled_operator_report_v1';
const KEY_HANDLED_REVIEW = 'dmz_notification_handled_review_v1';
const KEY_HANDLED_VERIFIED = 'dmz_notification_handled_verified_v1';
const KEY_HANDLED_SEASON = 'dmz_notification_handled_season_v1';
const RECENT_FOREGROUND_EVENT_MS = 30 * 60 * 1000;
const BACKGROUND_KICK_MS = 60 * 1000;

let backgroundKickTimer: ReturnType<typeof setTimeout> | null = null;

type RaidSnapshot = {
  reports: number;
  pending: boolean;
  verified: boolean;
  pendingReason: string;
};

type Baseline = {
  operatorKey: string;
  playerReports: number;
  raids: Record<string, RaidSnapshot>;
};

export type ForegroundOperatorAlertState = {
  playerId: string;
  name: string;
  reports: number;
  raids: Record<string, RaidSnapshot>;
};

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function shorten(value: unknown, max: number): string {
  const text = clean(value);
  return text.length <= max ? text : text.slice(0, Math.max(0, max - 1)) + '…';
}

async function markSync(result: string): Promise<void> {
  await AsyncStorage.setItem(
    KEY_LAST_SYNC,
    JSON.stringify({ at: Date.now(), result: clean(result) || 'OK' })
  );
}

async function fetchPublicState(): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(PUBLIC_STATE_URL, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Referer: 'https://dmzranked.com/',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 DMZRanked/1.0.65'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function collectRaids(
  raids: any[],
  playerId: string,
  playerName: string
): Record<string, RaidSnapshot> {
  const out: Record<string, RaidSnapshot> = {};
  for (const raid of raids) {
    const raidPlayerId = clean(raid?.playerId);
    const raidPlayerName = clean(raid?.playerName);
    const belongs =
      (!!playerId && raidPlayerId === playerId) ||
      raidPlayerName.toLowerCase() === playerName.toLowerCase();
    if (!belongs) continue;

    const raidId = clean(raid?.id);
    if (!raidId) continue;
    out[raidId] = {
      reports: Math.max(0, Number(raid?.reports) || 0),
      pending: Boolean(raid?.pending),
      verified: Boolean(raid?.verified),
      pendingReason: clean(raid?.pendingReason)
    };
  }
  return out;
}

async function recentlyHandled(key: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(key);
  const value = Number(raw || 0);
  return value > 0 && Date.now() - value < RECENT_FOREGROUND_EVENT_MS;
}

async function markHandled(key: string): Promise<void> {
  await AsyncStorage.setItem(key, String(Date.now()));
}

function handledKeyFor(title: string, body: string): string | null {
  const text = `${title} ${body}`.toLowerCase();
  if (
    (text.includes('one of your raids') || text.includes('your raid')) &&
    text.includes('report')
  ) {
    return KEY_HANDLED_RAID_REPORT;
  }
  if (
    text.includes('operator') &&
    text.includes('report') &&
    (text.includes('your operator') || text.includes('profile'))
  ) {
    return KEY_HANDLED_OPERATOR_REPORT;
  }
  if (text.includes('under review') || text.includes('review hold')) {
    return KEY_HANDLED_REVIEW;
  }
  if (text.includes('approved') || text.includes('verified')) {
    return KEY_HANDLED_VERIFIED;
  }
  if (text.includes('season update') || text.includes('new season')) {
    return KEY_HANDLED_SEASON;
  }
  return null;
}

export async function recordForegroundNotification(
  title: string,
  body: string
): Promise<void> {
  const key = handledKeyFor(title, body);
  if (key) await markHandled(key);
}

async function post(
  title: string,
  body: string,
  handledKey?: string
): Promise<void> {
  if (handledKey && (await recentlyHandled(handledKey))) return;
  await showWebsiteNotification(title, body);
  if (handledKey) await markHandled(handledKey);
}

async function syncSeason(root: any): Promise<void> {
  const season = root?.meta?.season;
  if (!season) return;

  const name = clean(season.name);
  const key = `${name}|${Number(season.updatedAt) || 0}`;
  const previous = (await AsyncStorage.getItem(KEY_SEASON)) ?? '';

  if (previous && previous !== key) {
    await post(
      '[System] Season update',
      name
        ? `DMZ Ranked is now showing ${name}.`
        : 'DMZ Ranked season information changed.',
      KEY_HANDLED_SEASON
    );
  }
  await AsyncStorage.setItem(KEY_SEASON, key);
}

export async function syncNotificationsNow(
  options: { skipWhileAppForeground?: boolean } = {}
): Promise<boolean> {
  const settings = await loadSettings();
  if (!settings.siteNotifications) return true;

  try {
    const root = await fetchPublicState();
    await syncSeason(root);

    const selected = clean(settings.selectedOperator);
    if (!selected) {
      await markSync('OK • no operator selected');
      return true;
    }

    const players = Array.isArray(root?.players) ? root.players : null;
    const raids = Array.isArray(root?.raids) ? root.raids : null;
    if (!players || !raids) {
      await markSync('ERROR • invalid public state');
      return false;
    }

    const player = players.find(
      (value: any) => clean(value?.name).toLowerCase() === selected.toLowerCase()
    );
    if (!player) {
      await markSync('OK • selected operator not found');
      return true;
    }

    const playerId = clean(player.id);
    const canonicalName = clean(player.name) || selected;
    const operatorKey = `${playerId}|${canonicalName.toLowerCase()}`.trim();
    const nextRaids = collectRaids(raids, playerId, canonicalName);
    const nextPlayerReports = Math.max(0, Number(player.reports) || 0);

    const previousRaw = await AsyncStorage.getItem(KEY_BASELINE);
    const previous = previousRaw
      ? (JSON.parse(previousRaw) as Baseline)
      : null;

    const nextBaseline: Baseline = {
      operatorKey,
      playerReports: nextPlayerReports,
      raids: nextRaids
    };

    if (!previous || previous.operatorKey !== operatorKey) {
      await AsyncStorage.setItem(KEY_BASELINE, JSON.stringify(nextBaseline));
      await markSync('OK • baseline primed');
      return true;
    }

    if (
      options.skipWhileAppForeground &&
      (await AsyncStorage.getItem(KEY_APP_FOREGROUND)) === '1'
    ) {
      await markSync('OK • app active');
      return true;
    }

    if (nextPlayerReports > previous.playerReports) {
      await post(
        '[Reports] Operator reported',
        `Hey ${canonicalName} — your operator profile was reported`,
        KEY_HANDLED_OPERATOR_REPORT
      );
    }

    for (const [raidId, next] of Object.entries(nextRaids)) {
      const before = previous.raids[raidId] ?? {
        reports: 0,
        pending: false,
        verified: false,
        pendingReason: ''
      };

      if (next.reports > before.reports) {
        await post(
          '[Reports] Raid reported',
          `Hey ${canonicalName} — one of your raids was reported`,
          KEY_HANDLED_RAID_REPORT
        );
      }

      if (next.pending && !before.pending) {
        const reason = shorten(next.pendingReason, 160);
        await post(
          '[Review] Raid under review',
          `Hey ${canonicalName} — one of your raids is under review${reason ? ` • ${reason}` : ''}`,
          KEY_HANDLED_REVIEW
        );
      }

      if (next.verified && !before.verified) {
        await post(
          '[Approved] Raid approved',
          `Hey ${canonicalName} — one of your raids was approved and verified`,
          KEY_HANDLED_VERIFIED
        );
      }
    }

    for (const raidId of Object.keys(previous.raids)) {
      if (!nextRaids[raidId]) {
        await post(
          '[Raids] Raid removed',
          `Hey ${canonicalName} — one of your raids is no longer on the live board.`
        );
      }
    }

    await AsyncStorage.setItem(KEY_BASELINE, JSON.stringify(nextBaseline));
    await markSync('OK');
    return true;
  } catch (error) {
    await markSync(`ERROR • ${shorten(error instanceof Error ? error.message : error, 120)}`);
    return false;
  }
}


export async function processForegroundOperatorState(
  next: ForegroundOperatorAlertState
): Promise<void> {
  const settings = await loadSettings();
  if (!settings.siteNotifications) return;

  const selected = clean(settings.selectedOperator);
  const name = clean(next.name) || selected;
  if (!selected || !name || name.toLowerCase() !== selected.toLowerCase()) return;

  const playerId = clean(next.playerId);
  const operatorKey = `${playerId}|${name.toLowerCase()}`.trim();
  const raids = next.raids && typeof next.raids === 'object' ? next.raids : {};
  const playerReports = Math.max(0, Number(next.reports) || 0);
  const nextBaseline: Baseline = {
    operatorKey,
    playerReports,
    raids
  };

  let previous: Baseline | null = null;
  try {
    const raw = await AsyncStorage.getItem(KEY_BASELINE);
    previous = raw ? (JSON.parse(raw) as Baseline) : null;
  } catch {
    previous = null;
  }

  if (!previous || previous.operatorKey !== operatorKey) {
    await AsyncStorage.setItem(KEY_BASELINE, JSON.stringify(nextBaseline));
    return;
  }

  if (playerReports > previous.playerReports) {
    await post(
      '[Reports] Operator reported',
      `Hey ${name} — your operator profile was reported`,
      KEY_HANDLED_OPERATOR_REPORT
    );
  }

  for (const [raidId, state] of Object.entries(raids)) {
    const before = previous.raids[raidId];
    if (!before) continue;

    if (state.reports > before.reports) {
      await post(
        '[Reports] Raid reported',
        `Hey ${name} — one of your raids was reported`,
        KEY_HANDLED_RAID_REPORT
      );
    }
    if (state.pending && !before.pending) {
      const reason = shorten(state.pendingReason, 160);
      await post(
        '[Review] Raid under review',
        `Hey ${name} — one of your raids is under review${reason ? ` • ${reason}` : ''}`,
        KEY_HANDLED_REVIEW
      );
    }
    if (state.verified && !before.verified) {
      await post(
        '[Approved] Raid approved',
        `Hey ${name} — one of your raids was approved and verified`,
        KEY_HANDLED_VERIFIED
      );
    }
  }

  await AsyncStorage.setItem(KEY_BASELINE, JSON.stringify(nextBaseline));
}

TaskManager.defineTask(TASK_NAME, async () => {
  const ok = await syncNotificationsNow({ skipWhileAppForeground: true });
  return ok
    ? BackgroundTask.BackgroundTaskResult.Success
    : BackgroundTask.BackgroundTaskResult.Failed;
});

export async function configureBackgroundNotifications(
  enabled: boolean
): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (!enabled) {
    if (registered) {
      await BackgroundTask.unregisterTaskAsync(TASK_NAME);
    }
    return;
  }

  await BackgroundTask.registerTaskAsync(TASK_NAME, {
    minimumInterval: 15
  });
}

export async function setNotificationAppForeground(
  foreground: boolean
): Promise<void> {
  await AsyncStorage.setItem(KEY_APP_FOREGROUND, foreground ? '1' : '0');
  if (foreground && backgroundKickTimer) {
    clearTimeout(backgroundKickTimer);
    backgroundKickTimer = null;
  }
}

export async function primeNotificationBaseline(): Promise<void> {
  const settings = await loadSettings();
  if (!settings.siteNotifications) return;
  const baseline = await AsyncStorage.getItem(KEY_BASELINE);
  if (!baseline) {
    await syncNotificationsNow({ skipWhileAppForeground: false });
  }
}

export function scheduleNotificationBackgroundKick(): void {
  if (backgroundKickTimer) clearTimeout(backgroundKickTimer);
  backgroundKickTimer = setTimeout(() => {
    backgroundKickTimer = null;
    void syncNotificationsNow({ skipWhileAppForeground: true });
  }, BACKGROUND_KICK_MS);
}

export async function resetNotificationSyncState(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEY_BASELINE,
    KEY_SEASON,
    KEY_LAST_SYNC,
    KEY_HANDLED_RAID_REPORT,
    KEY_HANDLED_OPERATOR_REPORT,
    KEY_HANDLED_REVIEW,
    KEY_HANDLED_VERIFIED,
    KEY_HANDLED_SEASON,
    KEY_APP_FOREGROUND
  ]);
}

export async function getLastNotificationSync(): Promise<{
  at: number;
  result: string;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_LAST_SYNC);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
