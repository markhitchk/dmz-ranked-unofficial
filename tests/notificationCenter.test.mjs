import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyNotification,
  cleanStoredNotifications,
  mergedNotificationItems,
  noticeTitle
} from '../src/services/notificationCenterCore.ts';

test('routes the existing website and system alert categories into one bell inbox', () => {
  assert.equal(classifyNotification('[Reports] Raid reported'), 'reports');
  assert.equal(classifyNotification('[Review] Raid under review'), 'reports');
  assert.equal(classifyNotification('[Approved] Raid approved'), 'reports');
  assert.equal(classifyNotification('[Update] New version'), 'updates');
  assert.equal(classifyNotification('[System] Season update'), 'system');
  assert.equal(classifyNotification('[Website] Maintenance'), 'website');
  assert.equal(noticeTitle('[Reports] Raid reported'), 'Raid reported');
});

test('inbox history validation discards corrupt records and preserves read state', () => {
  const records = cleanStoredNotifications([
    { id: 'new', title: '[System] Ready', body: 'Hello', receivedAt: 200, read: false },
    { id: 'older', title: '[Reports] Alert', body: 'Something changed', category: 'reports',
      priority: 'warning', receivedAt: 100, read: true },
    { id: 'new', title: '[System] Repeated', body: 'Ignored', receivedAt: 300 },
    { id: 'bad id', title: 'Bad', body: 'Bad', receivedAt: 400 },
    { id: 'malformed', title: 'Wrong time', body: 'Nope', receivedAt: 'oops' }
  ]);
  assert.deepEqual(records.map(record => record.id), ['new', 'older']);
  assert.equal(records[0].read, false);
  assert.equal(records[1].read, true);
  assert.equal(records[1].priority, 'warning');
});

test('announcements and local notifications merge without confusing read flags', () => {
  const remote = [{
    id: 'release', title: 'Message from Harley', body: 'Please update',
    priority: 'important', link: 'https://example.com'
  }];
  const stored = [
    { id: 'alert-1', title: '[Reports] Raid reported', body: 'Raid submitted',
      category: 'reports', priority: 'warning', receivedAt: 1000, read: false }
  ];
  const entries = mergedNotificationItems(remote, ['release'], stored);
  assert.deepEqual(entries.map(item => item.id), ['local:alert-1', 'remote:release']);
  assert.equal(entries[0].isRead, false);
  assert.equal(entries[1].isRead, true);
  assert.equal(entries[1].category, 'developer');
  assert.equal(entries[1].link, 'https://example.com');
});
