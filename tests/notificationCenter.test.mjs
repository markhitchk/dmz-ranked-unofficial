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

test('historical developer messages remain readable after remote feed expiry', () => {
  const archived = [{
    id: 'announcement-1', title: 'Studio news', body: 'Released yesterday',
    priority: 'info', firstSeenAt: 3000
  }];
  const list = mergedNotificationItems([], [], [], archived);
  assert.deepEqual(list.map(item => item.id), ['remote:announcement-1']);
  assert.equal(list[0].isRead, true);
  assert.equal(list[0].receivedAt, 3000);
  assert.equal(list[0].category, 'developer');
});

test('remote active messages merge with archive snapshots without duplicates', () => {
  const message = { id: 'release-1', title: 'New update', body: 'Try it',
    priority: 'important' };
  const archive = [{ ...message, firstSeenAt: 1000 }];
  const list = mergedNotificationItems([message], [], [], archive);
  assert.equal(list.length, 1);
  assert.equal(list[0].receivedAt, 1000);
  assert.equal(list[0].isRead, false);
});

test('deleted local alerts and remote announcements stay hidden after refresh', () => {
  const remote = [{ id: 'announcement', title: 'Pinned', body: 'Hello', priority: 'info' }];
  const local = [{ id: 'local1', title: '[System] Test', body: 'OK',
    category: 'system', priority: 'info', receivedAt: 123, read: false }];
  const deleted = ['remote:announcement', 'local:local1'];
  const list = mergedNotificationItems(remote, [], local, [], deleted);
  assert.deepEqual(list, []);
});

test('inbox removal cannot erase the immutable notification history', () => {
  const remote = [{ id: 'release-5', title: 'Studio announcement',
    body: 'Server information', priority: 'info' }];
  const stored = [{ id: 'local-5', title: '[Reports] New report',
    body: 'Your raid has been reported', category: 'reports',
    priority: 'warning', receivedAt: 4567, read: false }];
  const archive = [{ ...remote[0], firstSeenAt: 1234 }];
  const removedFromInbox = ['remote:release-5', 'local:local-5'];

  const inbox = mergedNotificationItems(remote, [], stored, [], removedFromInbox);
  const history = mergedNotificationItems(remote, [], stored, archive);

  assert.equal(inbox.length, 0);
  assert.deepEqual(history.map(item => item.id), ['local:local-5', 'remote:release-5']);
  assert.equal(history[0].body, stored[0].body);
});

test('expired developer announcements remain in history but not inbox', () => {
  const archive = [{ id: 'expired', title: 'Older update', body: 'Old notice',
    priority: 'info', firstSeenAt: 1670000000000 }];
  const inbox = mergedNotificationItems([], [], [], []);
  const history = mergedNotificationItems([], [], [], archive);
  assert.equal(inbox.length, 0);
  assert.equal(history.length, 1);
  assert.equal(history[0].isRead, true);
});

test('long notification history arrays are not truncated on load', () => {
  const input = Array.from({ length: 350 }, (_, index) => ({
    id: 'record-' + index,
    title: 'Event ' + index,
    body: 'Text',
    receivedAt: index + 1,
    read: true
  }));
  const result = cleanStoredNotifications(input);
  assert.equal(result.length, input.length);
});
