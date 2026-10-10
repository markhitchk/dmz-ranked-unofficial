import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppMessage } from './appMessagesCore';
import type { ArchivedRemoteMessage } from './notificationCenterCore';

const ARCHIVE_KEY = 'dmz_notification_center_remote_history_v1';
const DELETED_KEY = 'dmz_notification_center_deleted_v1';
let queue: Promise<void> = Promise.resolve();

function serial<T>(action: () => Promise<T>): Promise<T> {
  const result = queue.then(action, action);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

function validId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}
function cleanArchive(value: unknown): ArchivedRemoteMessage[] {
  if (!Array.isArray(value)) return [];
  const result: ArchivedRemoteMessage[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (!validId(item.id) || seen.has(item.id)) continue;
    if (typeof item.title !== 'string' || !item.title.trim() ||
        typeof item.body !== 'string' || !item.body.trim()) continue;
    const firstSeenAt = typeof item.firstSeenAt === 'number' && Number.isFinite(item.firstSeenAt)
      ? item.firstSeenAt : 0;
    const priority = item.priority === 'important' || item.priority === 'warning'
      ? item.priority : 'info';
    // History links come from the existing validated remote feed.
    const link = typeof item.link === 'string' && /^https:\/\//i.test(item.link)
      ? item.link.slice(0, 500) : undefined;
    result.push({
      id: item.id,
      title: item.title.slice(0, 100),
      body: item.body.slice(0, 2000),
      priority,
      firstSeenAt,
      ...(link ? { link, linkLabel: typeof item.linkLabel === 'string'
        ? item.linkLabel.slice(0, 50) : 'OPEN LINK' } : {})
    });
    seen.add(item.id);
  }
  return result;
}

async function readHistory(): Promise<ArchivedRemoteMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(ARCHIVE_KEY);
    return raw ? cleanArchive(JSON.parse(raw)) : [];
  } catch { return []; }
}

export async function loadArchivedRemoteMessages(): Promise<ArchivedRemoteMessage[]> {
  await queue;
  return readHistory();
}

export async function archiveRemoteMessages(messages: AppMessage[]): Promise<ArchivedRemoteMessage[]> {
  return serial(async () => {
    const existing = await readHistory();
    const map = new Map(existing.map(item => [item.id, item]));
    for (const message of messages) {
      if (!validId(message.id)) continue;
      const previous = map.get(message.id);
      map.set(message.id, {
        ...message,
        firstSeenAt: previous?.firstSeenAt || Date.now()
      });
    }
    const next = [...map.values()]
      .sort((a, b) => b.firstSeenAt - a.firstSeenAt);
    await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
    return next;
  });
}

function cleanDeleted(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const match = /^(?:remote:[a-zA-Z0-9_-]{1,80}|local:[a-zA-Z0-9_-]{1,100})$/;
  return [...new Set(value.filter((x): x is string => typeof x === 'string' && match.test(x)))];
}

export async function loadDeletedNotificationIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DELETED_KEY);
    return raw ? cleanDeleted(JSON.parse(raw)) : [];
  } catch { return []; }
}

export async function appendDeletedNotificationIds(ids: string[]): Promise<string[]> {
  return serial(async () => {
    const next = cleanDeleted([...(await loadDeletedNotificationIds()), ...ids]);
    await AsyncStorage.setItem(DELETED_KEY, JSON.stringify(next));
    return next;
  });
}
