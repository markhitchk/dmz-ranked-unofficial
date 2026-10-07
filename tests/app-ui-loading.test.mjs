import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { AppUiLoadGate } from '../src/services/appUiLoadGate.ts';
import { APP_UI_MARKER, buildRemoteUiInjection, isValidAppUiPayload } from '../src/services/appUiInjection.ts';

const css = `/* ${APP_UI_MARKER} */ body { color: gold; }` + ' '.repeat(1100);
const js = `/* ${APP_UI_MARKER} */
window.executions = (window.executions || 0) + 1;
window.__dmzHsBetaTabsRefresh = function() {};
window.__hsAppQolInstalled = true;
document.documentElement.setAttribute('data-dmz-app-css', 'active');
` + ' '.repeat(1100);

function pageHarness() {
  const elements = new Map();
  const attrs = new Map();
  const messages = [];
  const timers = new Map();
  let serial = 0;
  const state = { tab: false, rules: false };
  const document = {
    documentElement: {
      setAttribute: (key, value) => attrs.set(key, value),
      getAttribute: key => attrs.get(key)
    },
    head: { appendChild: element => elements.set(element.id, element) },
    getElementById: id => elements.get(id) || null,
    querySelector: () => state.tab ? {} : null,
    createElement: () => ({
      id: '', textContent: '',
      get sheet() { return state.rules ? { cssRules: [{}] } : null; }
    })
  };
  const context = vm.createContext({
    document,
    ReactNativeWebView: { postMessage: raw => messages.push(JSON.parse(raw)) },
    setTimeout: fn => { timers.set(++serial, fn); return serial; },
    clearTimeout: id => timers.delete(id)
  });
  context.window = context;
  const tick = () => {
    const entry = timers.entries().next().value;
    assert.ok(entry, 'a readiness check should be scheduled');
    timers.delete(entry[0]);
    entry[1]();
  };
  const makeReady = () => {
    state.tab = state.rules = true;
    elements.set('unofficial-app', {});
    elements.set('dmz-hs-active-user-stats', {});
  };
  return { context, document, elements, messages, tick, state, makeReady,
    inject: (id = 1, script = js, styles = css) => vm.runInContext(buildRemoteUiInjection(styles, script, id), context) };
}

test('loading waits for the document and verified UI; sending an injection is not readiness', () => {
  const gate = new AppUiLoadGate();
  const id = gate.begin(true);
  gate.loaded(id);
  assert.equal(gate.claimReady(id), false);
  gate.verified(id);
  assert.equal(gate.claimReady(id), true);
  assert.equal(gate.claimReady(id), false, 'completion is claimed only once');
});

test('UI ready before document completion also keeps the loader visible', () => {
  const gate = new AppUiLoadGate();
  const id = gate.begin(true);
  gate.verified(id);
  assert.equal(gate.claimReady(id), false);
  gate.loaded(id);
  assert.equal(gate.claimReady(id), true);
});

test('a reload ignores stale fetch acknowledgements and fade callbacks', () => {
  const gate = new AppUiLoadGate();
  const old = gate.begin(true);
  gate.loaded(old);
  gate.verified(old);
  assert.equal(gate.claimReady(old), true);
  const next = gate.begin(true);
  assert.equal(gate.isCurrent(old), false);
  gate.verified(old);
  gate.loaded(next);
  assert.equal(gate.claimReady(next), false);
  gate.verified(next);
  assert.equal(gate.claimReady(next), true);
});

test('page or override errors cannot be cleared by a subsequent load completion', () => {
  const gate = new AppUiLoadGate();
  const id = gate.begin(true);
  gate.fail(id);
  gate.loaded(id);
  gate.verified(id);
  assert.equal(gate.claimReady(id), false);
  const next = gate.begin(false);
  gate.loaded(next);
  assert.equal(gate.claimReady(next), true, 'disabled overrides require only a loaded document');
  gate.cancel();
  assert.equal(gate.isCurrent(next), false);
});

test('injected script waits for parsed CSS and the original App tab and stats DOM', () => {
  const page = pageHarness();
  page.inject(27);
  assert.equal(page.messages.length, 0);
  page.state.tab = true;
  page.elements.set('unofficial-app', {});
  page.elements.set('dmz-hs-active-user-stats', {});
  page.tick();
  assert.equal(page.messages.length, 0, 'unparsed CSS must not release loading');
  page.state.rules = true;
  page.tick();
  assert.equal(page.messages.length, 0, 'wait for stable readiness');
  page.tick();
  assert.deepEqual(page.messages, [{ type: 'app-ui-ready', pageId: 27 }]);
  assert.equal(page.elements.get('hs-remote-app-ui-style').textContent, css);
});

test('head replacement during finalization is repaired using the original stylesheet ID', () => {
  const page = pageHarness();
  page.makeReady();
  page.inject();
  page.elements.delete('hs-remote-app-ui-style');
  page.tick();
  assert.equal(page.elements.get('hs-remote-app-ui-style').textContent, css);
  assert.equal(page.context.__DMZ_APP_CSS_TEXT, css);
  assert.equal(page.messages[0].type, 'app-ui-ready');
});

test('JavaScript failures, invalid payloads, and missing DOM report errors without ready', () => {
  for (const scenario of ['throw', 'syntax', 'payload', 'missing-dom']) {
    const page = pageHarness();
    if (scenario === 'throw') page.inject(9, js + "throw new Error('broken override');");
    if (scenario === 'syntax') page.inject(9, js + '(');
    if (scenario === 'payload') page.inject(9, js, '<html>Error</html>');
    if (scenario === 'missing-dom') {
      page.inject(9);
      for (let n = 0; n < 99; n++) page.tick();
    }
    assert.equal(page.messages.length, 1, scenario);
    assert.equal(page.messages[0].type, 'app-ui-error', scenario);
    assert.equal(page.messages[0].pageId, 9, scenario);
  }
});

test('reinstall cancels old readiness checks and does not duplicate app JS listeners', () => {
  const page = pageHarness();
  page.inject(1);
  page.inject(2);
  page.makeReady();
  page.tick();
  page.tick();
  assert.deepEqual(page.messages, [{ type: 'app-ui-ready', pageId: 2 }]);
  assert.equal(page.context.executions, 1);
});

test('bundled fallback is a complete, valid original app UI and parses as JavaScript', () => {
  const bundle = JSON.parse(readFileSync(new URL('../assets/dmz_app_ui.json', import.meta.url), 'utf8'));
  assert.equal(isValidAppUiPayload(bundle.css), true);
  assert.equal(isValidAppUiPayload(bundle.js), true);
  assert.equal(isValidAppUiPayload(''), false);
  assert.equal(isValidAppUiPayload('<html>GitHub unavailable</html>'), false);
  assert.equal(isValidAppUiPayload(css + ' '.repeat(512 * 1024)), false);
  new vm.Script(bundle.js);
});
