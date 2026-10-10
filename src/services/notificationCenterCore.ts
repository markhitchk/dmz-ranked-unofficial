export type NoticeCategory = 'system' | 'reports' | 'updates' | 'website' | 'developer';
export type NoticePriority = 'info' | 'warning' | 'important';

export type StoredNotification = {
  id: string;
  title: string;
  body: string;
  category: Exclude<NoticeCategory, 'developer'>;
  priority: NoticePriority;
  receivedAt: number;
  read: boolean;
};

export type NotificationCenterItem = {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  priority: NoticePriority;
  receivedAt: number;
  isRead: boolean;
  link?: string;
  linkLabel?: string;
};

export function classifyNotification(title: string): Exclude<NoticeCategory, 'developer'> {
  if (/^\[(?:reports?|review|approved|raid|raids)\]/i.test(title)) return 'reports';
  if (/^\[(?:update|updates|season)\]/i.test(title) || /update available/i.test(title)) return 'updates';
  if (/^\[website\]/i.test(title)) return 'website';
  return 'system';
}

export function noticeTitle(title: string): string {
  return title.replace(/^\[[^\]]{1,24}\]\s*/, '').trim() || 'DMZ Ranked notice';
}

export function cleanStoredNotifications(raw: unknown): StoredNotification[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: StoredNotification[] = [];
  for (const value of raw.slice(0, 300)) {
    if (!value || typeof value !== 'object') continue;
    const record = value as Partial<StoredNotification>;
    if (typeof record.id !== 'string' || !/^[\w-]{1,100}$/.test(record.id) || seen.has(record.id)) continue;
    if (typeof record.title !== 'string' || !record.title.trim() || typeof record.body !== 'string') continue;
    if (typeof record.receivedAt !== 'number' || !Number.isFinite(record.receivedAt)) continue;
    seen.add(record.id);
    result.push({
      id: record.id,
      title: record.title.slice(0, 150),
      body: record.body.slice(0, 1000),
      category: record.category === 'reports' || record.category === 'updates' ||
        record.category === 'website' ? record.category : 'system',
      priority: record.priority === 'important' || record.priority === 'warning' ? record.priority : 'info',
      receivedAt: record.receivedAt,
      read: Boolean(record.read)
    });
  }
  return result.sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 150);
}

export function mergedNotificationItems(
  remote: Array<{ id: string; title: string; body: string; priority: NoticePriority;
    link?: string; linkLabel?: string }>,
  readRemote: string[],
  stored: StoredNotification[]
): NotificationCenterItem[] {
  const seen = new Set(readRemote);
  const remoteItems: NotificationCenterItem[] = remote.map((message, index) => ({
    id: 'remote:' + message.id,
    title: message.title,
    body: message.body,
    category: 'developer',
    priority: message.priority,
    receivedAt: 0 - index,
    isRead: seen.has(message.id),
    ...(message.link ? { link: message.link, linkLabel: message.linkLabel } : {})
  }));
  const localItems: NotificationCenterItem[] = stored.map(message => ({
    id: 'local:' + message.id,
    title: noticeTitle(message.title),
    body: message.body,
    category: message.category,
    priority: message.priority,
    receivedAt: message.receivedAt,
    isRead: message.read
  }));
  return [...remoteItems, ...localItems].sort((a, b) => b.receivedAt - a.receivedAt);
}
