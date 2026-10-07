import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const bundle = JSON.parse(
  readFileSync(new URL('../assets/dmz_app_ui.json', import.meta.url), 'utf8')
);
const source = String(bundle.js || '');
const css = String(bundle.css || '');

function extractFunction(name) {
  const needles = ['function ' + name + '(', 'async function ' + name + '('];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.notEqual(start, -1, name + ' must exist in bundled App UI');
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('Could not extract ' + name);
}


test('iOS support campaign v2 is new for users who already saw v1', () => {
  const match = source.match(/var IOS_SUPPORT_CAMPAIGN_KEY="([^"]+)"/);
  assert.ok(match, 'campaign key must be declared in bundled App UI');
  assert.equal(match[1], 'hs_dmz_ios_release_campaign_v2');

  const context = vm.createContext({
    navigator: { userAgent: 'DMZRankedApp/1.0.69 (Android 16; com.harleytg.dmzranked.beta)' },
    IOS_SUPPORT_CAMPAIGN_KEY: match[1],
    getStore(key) {
      return key === 'hs_dmz_ios_release_campaign_v1' ? '1' : '';
    },
    hasBlockingPopup() { return false; }
  });
  vm.runInContext(extractFunction('shouldShowIosSupportPopup'), context);

  assert.equal(
    context.shouldShowIosSupportPopup(),
    true,
    'seeing campaign v1 must not suppress campaign v2'
  );
});

test('iOS support campaign only prompts eligible Android app users once', () => {
  let seen = '';
  let blocked = false;
  const context = vm.createContext({
    navigator: { userAgent: 'DMZRankedApp/1.0.69 (Android 16; com.harleytg.dmzranked.beta)' },
    IOS_SUPPORT_CAMPAIGN_KEY: 'hs_dmz_ios_release_campaign_v1',
    getStore() { return seen; },
    hasBlockingPopup() { return blocked; }
  });
  vm.runInContext(extractFunction('shouldShowIosSupportPopup'), context);

  assert.equal(context.shouldShowIosSupportPopup(), true);
  seen = '1';
  assert.equal(context.shouldShowIosSupportPopup(), false);

  seen = '';
  blocked = true;
  assert.equal(context.shouldShowIosSupportPopup(), false);

  blocked = false;
  context.navigator.userAgent = 'DMZRankedApp/1.0.69 (iPhone; iOS)';
  assert.equal(context.shouldShowIosSupportPopup(), false);
});

test('iOS release popup copy is app-specific, voluntary, and dismissible', () => {
  const context = vm.createContext({});
  vm.runInContext(extractFunction('iosSupportPopupMarkup'), context);
  const html = context.iosSupportPopupMarkup();

  assert.match(html, /Help bring DMZ Ranked to iOS/i);
  assert.match(html, /iPhone/i);
  assert.match(html, /voluntary/i);
  assert.match(html, /Support the iOS release/i);
  assert.match(html, /Not now/i);
});

test('bundled App UI includes dedicated popup styling without changing website modal classes', () => {
  assert.match(css, /#hs-ios-support-overlay/);
  assert.match(css, /\.hs-ios-support-card/);
  assert.match(css, /\.hs-ios-support-primary/);
  assert.match(css, /\.hs-ios-support-secondary/);
});
