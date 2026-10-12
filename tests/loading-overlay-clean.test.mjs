import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('native loading overlay shows only branding, version and progress', () => {
  const overlay = read('src/components/LoadingOverlay.tsx');
  assert.match(overlay, /<Image/);
  assert.match(overlay, /Version \{version\} • Build \{build\}/);
  assert.match(overlay, /style=\{\[styles\.fill, \{ width:/);
  assert.doesNotMatch(overlay, /cachedPreview|cachedCard|cachedRow|cachedNote|Cached standings|Previous device snapshot/);
  assert.doesNotMatch(overlay, /\bverbose\b|\bstatus\b|styles\.verbose/i);
});

test('WebView still loads and saves public cached content in background without UI state', () => {
  const screen = read('src/screens/DmzWebScreen.tsx');
  assert.match(screen, /loadLeaderboardSnapshot\(\)/);
  assert.match(screen, /buildLeaderboardHydrationScript\(cachedBoard\.current\)/);
  assert.match(screen, /saveLeaderboardSnapshot\(nativeMessage\.data\)/);
  assert.doesNotMatch(screen, /setCachedPreview|cachedPreview=|setStatus\(/);
});
