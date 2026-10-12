import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { LEADERBOARD_SNAPSHOT_SCRIPT } from '../src/services/leaderboardSnapshotInjection.ts';

function harness(hostname = 'dmzranked.com') {
  const messages = [];
  const timeouts = [];
  const intervals = [];
  const rows = [{ textContent: '1 Bravo 2,850 SR 14 Raids', closest: () => null }];
  const standing = {
    querySelectorAll(selector) {
      if (selector.includes('tbody tr')) return rows;
      return [];
    }
  };
  const page = {
    readyState: 'complete',
    visibilityState: 'visible',
    body: {},
    querySelector(selector) {
      return selector === '#standings' ? standing : null;
    },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener() {}
  };
  const context = vm.createContext({
    document: page,
    location: { hostname, href: 'https://' + hostname + '/' },
    Date,
    setTimeout(fn) { timeouts.push(fn); },
    setInterval(fn) { intervals.push(fn); return 1; },
    clearInterval() {},
    ReactNativeWebView: {
      postMessage(raw) { messages.push(JSON.parse(raw)); }
    }
  });
  context.window = context;
  return {
    context, page, rows, messages, timeouts, intervals,
    capture() { context.__dmzRnCaptureLeaderboardSnapshot(); }
  };
}

test('the WebView snapshot is passive and sends bounded public standings', () => {
  const app = harness();
  new vm.Script(LEADERBOARD_SNAPSHOT_SCRIPT);
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  assert.equal(app.intervals.length, 1);
  app.capture();
  assert.equal(app.messages.length, 1);
  assert.equal(app.messages[0].type, 'public-leaderboard-snapshot');
  assert.equal(app.messages[0].data.standings[0], '1 Bravo 2,850 SR 14 Raids');
  assert.equal(app.messages[0].data.sourceUrl, 'https://dmzranked.com/');
  assert.ok(app.messages[0].data.counters);
});

test('unchanged snapshots are deduplicated; changes are observed without fetching', () => {
  const app = harness();
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  app.capture();
  app.capture();
  assert.equal(app.messages.length, 1);
  app.rows[0].textContent = '1 Bravo 3,000 SR 15 Raids';
  app.capture();
  assert.equal(app.messages.length, 2);
  assert.equal(app.messages[1].data.standings[0], '1 Bravo 3,000 SR 15 Raids');
});

test('capture pauses when WebView is hidden or the user is scrolling', () => {
  const app = harness();
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  app.page.visibilityState = 'hidden';
  app.capture();
  app.page.visibilityState = 'visible';
  app.context.__dmzAppScrolling = true;
  app.capture();
  assert.equal(app.messages.length, 0);
  app.context.__dmzAppScrolling = false;
  app.capture();
  assert.equal(app.messages.length, 1);
});

test('injection is idempotent and does not run on external websites', () => {
  const app = harness();
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  assert.equal(app.intervals.length, 1);
  const outside = harness('example.org');
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, outside.context);
  assert.equal(outside.intervals.length, 0);
  assert.equal(outside.context.__dmzRnLeaderboardSnapshotInstalled, undefined);
});

test('captured public rows are capped and never include form contents', () => {
  const app = harness();
  app.rows.length = 0;
  for (let i = 0; i < 120; i++) {
    app.rows.push({
      textContent: 'Rank ' + i + ' '.repeat(500) + '12 SR',
      closest() { return i === 1 ? {} : null; }
    });
  }
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  app.capture();
  assert.ok(app.messages[0].data.standings.length <= 100);
  assert.ok(app.messages[0].data.standings.every(x => x.length <= 220));
  assert.ok(!app.messages[0].data.standings.some(x => x.startsWith('Rank 1 ')));
});
