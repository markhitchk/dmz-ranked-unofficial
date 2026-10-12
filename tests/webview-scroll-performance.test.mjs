import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Android uses an explicit hardware WebView layer, not a software bitmap', () => {
  const src = read('src/screens/DmzWebScreen.tsx');
  assert.match(src, /androidLayerType="hardware"/);
  assert.doesNotMatch(src, /androidLayerType="software"/);
});

test('App UI repair avoids whole-document mutation monitoring during scroll', () => {
  const loader = read('src/services/appUiInjection.ts');
  const remote = read('remote/app-ui/app.js');
  assert.doesNotMatch(loader, /observer\.observe\(\s*document\.documentElement[\s\S]*?subtree:\s*true/);
  assert.doesNotMatch(remote, /observer\.observe\(document\.documentElement,\s*\{childList:true,subtree:true\}/);
  assert.doesNotMatch(remote, /observer\.observe\(document\.documentElement,\s*\{[\s\S]{0,55}subtree:\s*true/);
  assert.match(remote, /observer\.observe\(logSection,\{childList:true,subtree:true\}\)/);
});

test('Previous snapshot hydration no longer observes the whole document', () => {
  const src = read('src/services/leaderboardHydration.ts');
  assert.doesNotMatch(src, /watcher\.observe\(document\.documentElement/);
  assert.match(src, /setInterval\(finish, 250\)/);
});

test('Fast Android fling disables expensive glows temporarily and restores after idle', () => {
  const src = read('src/screens/DmzWebScreen.tsx');
  const css = read('remote/app-ui/app.css');
  assert.match(src, /root\.classList\.add\('hs-rapid-scroll'\)/);
  assert.match(src, /root\.classList\.remove\('hs-rapid-scroll'\)/);
  assert.match(css, /\.hs-android-webview\.hs-rapid-scroll/);
  assert.match(css, /animation-play-state:paused!important/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /content-visibility:\s*auto/i);
});

test('The optimized remote CSS and JS match the offline fallback byte-for-byte', () => {
  const fallback = JSON.parse(read('assets/dmz_app_ui.json'));
  assert.equal(fallback.css, read('remote/app-ui/app.css'));
  assert.equal(fallback.js, read('remote/app-ui/app.js'));
});
