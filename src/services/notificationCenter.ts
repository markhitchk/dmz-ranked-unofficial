import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  classifyNotification,
  cleanStoredNotifications,
  type StoredNotification,
  type NoticePriority
} from './notificationCenterCore';

const KEY = 'dmz_notification_center_history_v1';
const MAX_ITEMS = 150;
const DEDUP_WINDOW_MS = 90_000;
let mutations = Promise.resolve();
const listeners = new Set<() => void>();

function broadcast(): void {
  for (const listener of listeners) {
    try { listener(); } catch { /* Listeners cannot interrupt notification storage. */ }
  }
}
export function subscribeNotificationCenter(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const current = mutations.then(operation, operation);
  mutations = current.then(() => undefined, () => undefined);
  return current;
}
async function read(): Promise<StoredNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? cleanStoredNotifications(JSON.parse(raw)) : [];
  } catch { return []; }
}

export async function loadNotificationHistory(): Promise<StoredNotification[]> {
  await mutations;
  return read();
}

export async function recordLocalNotification(
  title: string,
  body: string,
  options: { priority?: NoticePriority; id?: string } = {}
): Promise<{ entry: StoredNotification; isNew: boolean }> {
  return serial(async () => {
    const cleanTitle = String(title || 'DMZ Ranked notice').trim().slice(0, 150);
    const cleanBody = String(body || 'New activity is available.').trim().slice(0, 1000);
    const current = await read();
    const now = Date.now();
    const recent = current.find(entry =>
      (options.id ? entry.id === options.id : (
        entry.title === cleanTitle &&
        entry.body === cleanBody &&
        now - entry.receivedAt >= 0 &&
        now - entry.receivedAt < DEDUP_WINDOW_MS
      ))
    );
    if (recent) return { entry: recent, isNew: false };

    const id = options.id && /^[\w-]{1,100}$/.test(options.id)
      ? options.id
      : now.toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    const entry: StoredNotification = {
      id,
      title: cleanTitle,
      body: cleanBody,
      category: classifyNotification(cleanTitle),
      priority: options.priority ?? (/^\[(?:reports?|review)\]/i.test(cleanTitle) ? 'warning' : 'info'),
      receivedAt: now,
      read: false
    };
    await AsyncStorage.setItem(KEY, JSON.stringify([entry, ...current].slice(0, MAX_ITEMS)));
    broadcast();
    return { entry, isNew: true };
  });
}

export async function markLocalNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await serial(async () => {
    const current = await read();
    const wanted = new Set(ids);
    if (!current.some(item => wanted.has(item.id) && !item.read)) return;
    const next = current.map(item => wanted.has(item.id) ? { ...item, read: true } : item);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    broadcast();
  });
}
