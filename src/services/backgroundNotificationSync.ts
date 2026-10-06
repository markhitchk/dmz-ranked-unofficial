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
          'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 DMZRanked/1.0.61'
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

async function post(title: string, body: string): Promise<void> {
  await showWebsiteNotification(title, body);
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
        : 'DMZ Ranked season information changed.'
    );
  }
  await AsyncStorage.setItem(KEY_SEASON, key);
}

export async function syncNotificationsNow(): Promise<boolean> {
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

    if (nextPlayerReports > previous.playerReports) {
      await post(
        '[Reports] Operator reported',
        `Hey ${canonicalName} — your operator profile was reported`
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
          `Hey ${canonicalName} — one of your raids was reported`
        );
      }

      if (next.pending && !before.pending) {
        const reason = shorten(next.pendingReason, 160);
        await post(
          '[Review] Raid under review',
          `Hey ${canonicalName} — one of your raids is under review${reason ? ` • ${reason}` : ''}`
        );
      }

      if (next.verified && !before.verified) {
        await post(
          '[Approved] Raid approved',
          `Hey ${canonicalName} — one of your raids was approved and verified`
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

TaskManager.defineTask(TASK_NAME, async () => {
  const ok = await syncNotificationsNow();
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

  if (!registered) {
    await BackgroundTask.registerTaskAsync(TASK_NAME, {
      minimumInterval: 15
    });
  }
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
