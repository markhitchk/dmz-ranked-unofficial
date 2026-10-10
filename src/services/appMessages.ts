import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppChannel } from '../types';
import { parseAppMessageFeed, type AppMessage } from './appMessagesCore';

// The message-only branch is independent of APK builds. Only repository
// collaborators can publish, and no GitHub credentials are stored in the app.
const REMOTE_FEED =
  'https://raw.githubusercontent.com/markhitchk/dmz-ranked-unofficial/app-messages/remote/app-messages.json';
const CACHE_KEY = 'dmz_app_messages_feed_v1';
const READ_KEY = 'dmz_app_messages_read_v1';
const TIMEOUT_MS = 5000;
const MAX_FEED_LENGTH = 80_000;

export async function loadAppMessages(channel: AppChannel): Promise<AppMessage[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${REMOTE_FEED}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Message server HTTP ' + response.status);
    const raw = await response.text();
    if (raw.length > MAX_FEED_LENGTH) throw new Error('Message feed exceeded size limit');
    const messages = parseAppMessageFeed(JSON.parse(raw), channel);
    // A valid, empty feed is important: removing announcements removes them
    // from the inbox even for clients that previously saw them.
    await AsyncStorage.setItem(CACHE_KEY, raw).catch(() => undefined);
    return messages;
  } catch {
    // If the device is offline, the last valid feed remains readable.
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached && cached.length <= MAX_FEED_LENGTH) {
        return parseAppMessageFeed(JSON.parse(cached), channel);
      }
    } catch {
      // No valid cached feed is available.
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadReadMessageIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(READ_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(
      (id): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id)
    ))].slice(-200);
  } catch {
    return [];
  }
}

export async function saveReadMessageIds(ids: string[]): Promise<void> {
  const safe = [...new Set(ids.filter(id => /^[a-zA-Z0-9_-]{1,80}$/.test(id)))].slice(-200);
  await AsyncStorage.setItem(READ_KEY, JSON.stringify(safe));
}
