import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { LEADERBOARD_SNAPSHOT_SCRIPT } from '../src/services/leaderboardSnapshotInjection.ts';

function harness(hostname = 'dmzranked.com') {
  const messages = [];
  const intervals = [];
  const mutations = [];
  const rows = [{
    textContent: '1 Bravo 2,850 SR 14 Raids',
    closest: () => null,
    getAttribute(name) { return name === 'data-profile' ? 'operator-bravo' : null; },
    querySelector(selector) {
      const values = {'.pname':'Bravo','td.num':'2,850',
        '.place':'1','.divlabel,.divmini':'Diamond II','.raids-mini':'14 raids'};
      return values[selector] ? {textContent:values[selector]} : null;
    }
  }];
  const board = {
    querySelector(selector) {
      if (selector.includes('tbody tr')) return rows.length ? rows[0] : null;
      return null;
    },
    querySelectorAll(selector) {
      return selector.includes('tbody tr[data-profile]') ? rows : [];
    }
  };
  const leaders = {
    querySelectorAll(selector) {
      if (selector !== '.ldr-card') return [];
      return [{
        textContent: 'Operator kills per raid avg 3.0',
        closest: () => null,
        querySelector(s) {
          return s === '.ldr-title' ? {textContent: 'Operator kills per raid'} :
            s === '.ldr-avg' ? {textContent: 'avg 3.0'} : null;
        }
      }];
    }
  };
  const elements = new Map([
    ['boardBody', board], ['leadersBody', leaders],
    ['playerCount', {textContent:'682 players'}],
    ['seasonBanner', {textContent:'Season 4 Confirmed Kills'}]
  ]);
  const page = {
    readyState: 'complete',
    visibilityState: 'visible',
    body: {},
    getElementById(id) { return elements.get(id) || null; },
    querySelectorAll() { return []; },
    querySelector(selector) {
      if (selector === '#playerCount') return elements.get('playerCount');
      if (selector === '#seasonBanner') return elements.get('seasonBanner');
      return null;
    },
    addEventListener() {}
  };
  const context = vm.createContext({
    document: page,
    location: { hostname, href: 'https://' + hostname + '/' },
    Date,
    setTimeout(fn) { return fn(); },
    clearTimeout() {},
    MutationObserver: class {
      constructor(callback) { this.callback = callback; mutations.push(this); }
      observe() {}
    },
    ReactNativeWebView: {
      postMessage(raw) { messages.push(JSON.parse(raw)); }
    }
  });
  context.window = context;
  return {
    context, page, rows, board, leaders, messages, elements, mutations,
    capture() { context.__dmzRnCaptureLeaderboardSnapshot(); }
  };
}

test('captures the site real interactive #boardBody standings without cloning DOM', () => {
  const app = harness();
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  app.capture();
  assert.equal(app.messages[0].type, 'public-standings-ready');
  assert.equal(app.messages[1].type, 'public-leaderboard-snapshot');
  assert.equal(app.messages[1].data.standings[0], '1 Bravo 2,850 SR 14 Raids');
  assert.deepEqual(JSON.parse(JSON.stringify(app.messages[1].data.boardRows[0])), {
    id: 'operator-bravo', name: 'Bravo', sr: '2,850',
    position: '1', rank: 'Diamond II', raids: '14 raids'
  });
  assert.equal(app.messages[1].data.leaders[0], 'Operator kills per raid avg 3.0');
  assert.equal(app.messages[1].data.counters.Players, '682 players');
  assert.equal(app.messages[1].data.counters['Leader: Operator kills per raid'], 'avg 3.0');
  assert.ok(!('innerHTML' in app.board), 'WebView retains the real click handlers and DOM');
});

test('identical snapshots are deduplicated but updated standings are captured', () => {
  const app = harness();
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  app.capture();
  app.capture();
  assert.equal(app.messages.filter(x => x.type === 'public-leaderboard-snapshot').length, 1);
  app.rows[0].textContent = '1 Bravo 3,000 SR 15 Raids';
  app.capture();
  assert.equal(app.messages.at(-1).data.standings[0], '1 Bravo 3,000 SR 15 Raids');
});

test('capture does no work while scrolling or in a hidden WebView', () => {
  const app = harness();
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  const baseline = app.messages.length;
  // A changed leaderboard should be deferred until scrolling/visibility ends.
  app.rows[0].textContent = '1 Bravo 3,200 SR 16 Raids';
  app.page.visibilityState = 'hidden';
  app.capture();
  app.page.visibilityState = 'visible';
  app.context.__dmzAppScrolling = true;
  app.capture();
  assert.equal(app.messages.length, baseline);
  app.context.__dmzAppScrolling = false;
  app.capture();
  assert.ok(app.messages.length > baseline);
});

test('injects only once per document and ignores external websites', () => {
  const app = harness();
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  const length = app.mutations.length;
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  assert.equal(app.mutations.length, length);
  const external = harness('example.org');
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, external.context);
  assert.equal(external.context.__dmzRnCaptureLeaderboardSnapshot, undefined);
});

test('caps public rows and never collects text from form controls', () => {
  const app = harness();
  app.rows.length = 0;
  for (let i = 0; i < 120; i++) {
    app.rows.push({
      textContent: 'Rank ' + i + ' '.repeat(500) + '12 SR',
      closest: () => i === 1 ? {} : null
    });
  }
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  const message = app.messages.find(x => x.type === 'public-leaderboard-snapshot');
  assert.ok(message.data.standings.length <= 70);
  assert.ok(message.data.standings.every(x => x.length <= 220));
  assert.ok(!message.data.standings.some(x => x.startsWith('Rank 1 ')));
});

test('empty board with only player count never produces misleading cached standings', () => {
  const app = harness();
  app.rows.length = 0;
  app.elements.delete('leadersBody');
  vm.runInContext(LEADERBOARD_SNAPSHOT_SCRIPT, app.context);
  assert.equal(app.messages.length, 0);
});
