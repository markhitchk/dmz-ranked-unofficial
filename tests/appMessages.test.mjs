import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAppMessageFeed } from '../src/services/appMessagesCore.ts';

const sample = {
  schemaVersion: 1,
  messages: [
    { id: 'hello-1', title: 'Hello', body: 'Welcome!', channels: ['all'], display: 'popup' },
    { id: 'beta-only', title: 'Beta', body: 'Beta news', channels: ['beta'] },
    { id: 'stable-only', title: 'Stable', body: 'Stable news', channels: ['stable'] }
  ]
};

test('messages target each app channel without leaking beta notes into stable', () => {
  assert.deepEqual(parseAppMessageFeed(sample, 'beta').map(m => m.id), ['hello-1', 'beta-only']);
  assert.deepEqual(parseAppMessageFeed(sample, 'stable').map(m => m.id), ['hello-1', 'stable-only']);
});

test('scheduled and expired messages are excluded at the correct timestamps', () => {
  const feed = { schemaVersion: 1, messages: [
    { id: 'future', title: 'Future', body: 'Soon', channels: ['all'], startsAt: '2026-12-01T00:00:00Z' },
    { id: 'gone', title: 'Gone', body: 'Old', channels: ['all'], expiresAt: '2026-09-01T00:00:00Z' },
    { id: 'now', title: 'Current', body: 'Active', channels: ['all'], startsAt: '2026-10-01T00:00:00Z', expiresAt: '2026-11-01T00:00:00Z' }
  ]};
  assert.deepEqual(parseAppMessageFeed(feed, 'beta', Date.parse('2026-10-09T12:00:00Z')).map(m => m.id), ['now']);
});

test('remote links are restricted to HTTPS and rich content is text only', () => {
  const feed = { schemaVersion: 1, messages: [
    { id: 'bad', title: 'Security', body: '<script>alert(1)</script>', channels: ['all'], link: 'javascript:alert(1)' },
    { id: 'good', title: 'Docs', body: 'Open docs', channels: ['all'], link: 'https://example.com/a', linkLabel: 'READ' }
  ] };
  const parsed = parseAppMessageFeed(feed, 'beta');
  assert.equal(parsed[0].link, undefined);
  assert.equal(parsed[0].body, '<script>alert(1)</script>');
  assert.equal(parsed[1].link, 'https://example.com/a');
  assert.equal(parsed[1].linkLabel, 'READ');
});

test('malformed records are ignored and invalid top-level payload is rejected', () => {
  assert.throws(() => parseAppMessageFeed({ messages: [] }, 'beta'));
  const feed = { schemaVersion: 1, messages: [
    { id: 'x', title: 'Missing audience', body: 'Cannot broadcast accidentally' },
    { id: 'x', title: 'First', body: 'Hello', channels: ['all'] },
    { id: 'x', title: 'Duplicate', body: 'Another', channels: ['all'] },
    { id: 'y', title: 'Disabled', body: 'Hidden', channels: ['all'], enabled: false },
    { id: 'z', title: 'Broken date', body: 'Hidden', channels: ['all'], startsAt: 'yesterday' }
  ] };
  assert.deepEqual(parseAppMessageFeed(feed, 'stable').map(m => m.title), ['First']);
});
