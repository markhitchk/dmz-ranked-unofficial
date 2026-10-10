import type { AppChannel } from '../types';

export type AppMessagePriority = 'info' | 'warning' | 'important';
export type AppMessageDisplay = 'inbox' | 'popup';

export type AppMessage = {
  id: string;
  title: string;
  body: string;
  priority: AppMessagePriority;
  display: AppMessageDisplay;
  link?: string;
  linkLabel?: string;
};

const MESSAGE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function timestamp(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) return NaN;
  return Date.parse(value);
}

function safeActionUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Parse the public, read-only message feed. Invalid items are discarded. */
export function parseAppMessageFeed(
  payload: unknown,
  channel: AppChannel,
  now = Date.now()
): AppMessage[] {
  if (
    !payload ||
    typeof payload !== 'object' ||
    (payload as { schemaVersion?: unknown }).schemaVersion !== 1 ||
    !Array.isArray((payload as { messages?: unknown }).messages)
  ) {
    throw new Error('Invalid DMZ Ranked message feed');
  }

  const input = (payload as { messages: unknown[] }).messages;
  if (input.length > 100) throw new Error('DMZ Ranked message feed is too large');
  const seen = new Set<string>();
  const messages: AppMessage[] = [];

  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    if (entry.enabled === false) continue;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const body = typeof entry.body === 'string' ? entry.body.trim() : '';

    if (!MESSAGE_ID.test(id) || seen.has(id) ||
        !title || title.length > 100 || !body || body.length > 2000) continue;

    // The audience is required to avoid accidentally broadcasting a targeted note.
    const targets = entry.channels;
    if (!Array.isArray(targets) || !targets.length ||
        !targets.every(target => target === 'all' || target === 'stable' || target === 'beta') ||
        (!targets.includes('all') && !targets.includes(channel))) continue;

    const starts = timestamp(entry.startsAt);
    const expires = timestamp(entry.expiresAt);
    if (Number.isNaN(starts) || Number.isNaN(expires)) continue;
    if (starts !== null && starts > now) continue;
    if (expires !== null && expires <= now) continue;
    if (starts !== null && expires !== null && expires <= starts) continue;

    seen.add(id);
    const priority: AppMessagePriority =
      entry.priority === 'warning' || entry.priority === 'important'
        ? entry.priority
        : 'info';
    const display: AppMessageDisplay = entry.display === 'popup' ? 'popup' : 'inbox';
    const link = safeActionUrl(entry.link);
    const linkLabel = typeof entry.linkLabel === 'string' && entry.linkLabel.trim()
      ? entry.linkLabel.trim().slice(0, 50)
      : 'OPEN LINK';

    messages.push({ id, title, body, priority, display, ...(link ? { link, linkLabel } : {}) });
  }

  return messages;
}
