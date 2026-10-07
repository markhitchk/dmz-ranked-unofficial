import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const bundle = JSON.parse(
  readFileSync(new URL('../assets/dmz_app_ui.json', import.meta.url), 'utf8')
);
const source = String(bundle.js || '');

function extractFunction(name) {
  const asyncNeedle = 'async function ' + name + '(';
  const syncNeedle = 'function ' + name + '(';
  let start = source.indexOf(asyncNeedle);
  if (start < 0) start = source.indexOf(syncNeedle);
  assert.notEqual(start, -1, name + ' must exist in bundled App UI');

  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let i = brace; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('Could not extract ' + name);
}

function createBadgeHarness() {
  const image = {
    hidden: true,
    dataset: {},
    src: '',
    removeAttribute(name) {
      if (name === 'src') this.src = '';
    },
    getAttribute(name) {
      return name === 'src' ? this.src : null;
    }
  };
  const fallback = { hidden: false, className: '', textContent: '' };
  const loaders = [];

  class FakeImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.src = '';
      loaders.push(this);
    }
  }

  const context = vm.createContext({
    document: {
      getElementById(id) {
        if (id === 'hs-stat-rank-badge') return image;
        if (id === 'hs-stat-rank-fallback') return fallback;
        return null;
      }
    },
    Image: FakeImage,
    URL,
    SITE_RANK_BADGES: { Bronze1: '/assets/bronze-1.webp', Silver1: '/assets/silver-1.webp' },
    lastStats: null,
    clean(value) {
      return String(value ?? '').replace(/\\s+/g, ' ').trim();
    }
  });

  vm.runInContext(
    [
      extractFunction('rankTierClass'),
      extractFunction('badgeKey'),
      extractFunction('loadBadgeMap'),
      extractFunction('renderRankBadge')
    ].join('\n'),
    context
  );

  return { context, image, fallback, loaders };
}

test('same live rank badge stays visible across repeated standings renders', async () => {
  const page = createBadgeHarness();
  const stats = { rankLabel: 'Bronze I', position: 358 };
  page.context.lastStats = stats;

  await page.context.renderRankBadge(stats);
  assert.equal(page.loaders.length, 1);
  assert.equal(page.image.hidden, true);
  assert.equal(page.fallback.hidden, false);

  page.loaders[0].onload();
  assert.equal(page.image.hidden, false);
  assert.equal(page.fallback.hidden, true);

  const loadedSrc = page.image.src;
  await page.context.renderRankBadge(stats);

  assert.equal(page.image.hidden, false, 'a refresh must not blank a badge that is already loaded');
  assert.equal(page.fallback.hidden, true, 'fallback must stay hidden for the same valid badge');
  assert.equal(page.image.src, loadedSrc);
  assert.equal(page.loaders.length, 1, 'the same badge must not be reloaded on every live refresh');
});

test('loading state keeps the last live badge instead of reverting to fallback', () => {
  const renderCalls = [];
  const lastStats = { rankLabel: 'Bronze I', position: 358 };
  const context = vm.createContext({
    lastStats,
    lastStatsOperator: 'HarleyTG',
    document: {
      getElementById() { return null; },
      querySelectorAll() { return []; }
    },
    appChannelLabel() { return 'BETA'; },
    clean(value) { return String(value ?? '').replace(/\\s+/g, ' ').trim(); },
    setText() {},
    renderRankBadge(value) { renderCalls.push(value); },
    renderMessages() {}
  });

  vm.runInContext(extractFunction('setStatsState'), context);
  context.setStatsState('loading', 'HarleyTG', null);

  assert.equal(renderCalls.length, 1);
  assert.equal(
    renderCalls[0],
    lastStats,
    'transient live refreshes must retain the last known rank badge'
  );
});
