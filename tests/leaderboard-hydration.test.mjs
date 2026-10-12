import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildLeaderboardHydrationScript } from '../src/services/leaderboardHydration.ts';

const sample = () => ({
  version: 1, capturedAt: Date.now(), sourceUrl: 'https://dmzranked.com/',
  season: 'Season 4', standings: ['1 Bravo 2850'],
  boardRows: [{id:'p-1', name:'Bravo', sr:'2,850', rank:'Diamond II',
    position:'1', raids:'14 raids'}],
  hallOfFame:[], leaders:[], awardStandings:[], medals:[], counters:{}
});

function element(tag = 'div') {
  const attributes = {};
  const node = {
    tagName: tag.toUpperCase(), className:'', textContent:'', children:[],
    get childNodes() { return this.children; },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(k,v) { attributes[k] = v; },
    getAttribute(k) { return attributes[k]; },
    querySelector(selector) {
      if (selector.includes('[data-dmz-cached]')) {
        return this.children.find(n => n.getAttribute?.('data-dmz-cached')) || null;
      }
      return null;
    }
  };
  return node;
}
function pageHarness(boardHasLive = false) {
  const board = element('div');
  if (boardHasLive) board.querySelector = () => ({});
  const messages = [];
  const document = {
    readyState:'complete', documentElement: element('html'), body: element('body'),
    getElementById(id) { return id === 'boardBody' ? board : null; },
    querySelector() { return null; },
    createElement: element,
    addEventListener() {}
  };
  const context = vm.createContext({
    document, location:{hostname:'dmzranked.com'}, Date,
    setTimeout() { return 1; },
    setInterval() { return 1; },
    clearInterval() {},
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    ReactNativeWebView: {postMessage(raw) { messages.push(JSON.parse(raw)); }}
  });
  context.window = context;
  return { board, messages, context };
}

test('local snapshot creates a real website preview inside #boardBody', () => {
  const page=pageHarness();
  const code=buildLeaderboardHydrationScript(sample());
  assert.ok(code);
  new vm.Script(code);
  vm.runInContext(code,page.context);
  assert.equal(page.board.children.length,1);
  const shell=page.board.children[0];
  assert.equal(shell.getAttribute('data-dmz-cached'),'true');
  assert.equal(page.messages[0].type,'public-standings-cache-restored');
  const table=shell.children[1];
  assert.equal(table.tagName,'TABLE');
  const tbody=table.children[1];
  const row=tbody.children[0];
  assert.equal(row.children[2].textContent,'2,850');
  assert.equal(row.children[0].children[0].children[1].children[0].textContent,'Bravo');
  assert.equal(row.getAttribute('data-profile'),undefined,
    'cached rows cannot open profiles before website live state is ready');
});

test('never overwrites a real live board', () => {
  const page=pageHarness(true);
  vm.runInContext(buildLeaderboardHydrationScript(sample()), page.context);
  assert.equal(page.board.children.length,0);
  assert.equal(page.messages.length,0);
});

test('old snapshots and out-of-date snapshots are not injected', () => {
  const old=sample();
  old.capturedAt=Date.now()-14*60*60*1000;
  assert.equal(buildLeaderboardHydrationScript(old),null);
  const missing=sample();
  missing.boardRows=[];
  assert.equal(buildLeaderboardHydrationScript(missing),null);
});

test('HTML-like operator names are rendered as inert text', () => {
  const page=pageHarness();
  const s=sample();
  s.boardRows[0].name='<script>bad()</script>';
  vm.runInContext(buildLeaderboardHydrationScript(s),page.context);
  assert.equal(page.board.children[0].children[1].children[1].children[0]
    .children[0].children[0].children[1].children[0].textContent,
    '<script>bad()</script>');
});
