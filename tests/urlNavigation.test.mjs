import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCollapsedBrowserUrl,
  isDmzRankedUrl,
  normalizeBrowserUrlInput
} from '../src/services/urlNavigation.ts';

test('normalizes typed addresses for the native URL bar', () => {
  assert.equal(
    normalizeBrowserUrlInput('dmzranked.com/app'),
    'https://dmzranked.com/app'
  );
  assert.equal(
    normalizeBrowserUrlInput('https://dmzranked.com/'),
    'https://dmzranked.com/'
  );
  assert.equal(normalizeBrowserUrlInput(''), null);
});

test('formats compact collapsed addresses without the scheme', () => {
  assert.equal(
    formatCollapsedBrowserUrl('https://dmzranked.com/app/'),
    'dmzranked.com/app'
  );
  assert.equal(
    formatCollapsedBrowserUrl('https://dmzranked.com/app?tab=beta#top'),
    'dmzranked.com/app?tab=beta#top'
  );
});

test('classifies DMZ Ranked navigation separately from external links', () => {
  assert.equal(isDmzRankedUrl('https://dmzranked.com/app'), true);
  assert.equal(isDmzRankedUrl('https://www.dmzranked.com/'), true);
  assert.equal(isDmzRankedUrl('https://paypal.com/example'), false);
  assert.equal(isDmzRankedUrl('javascript:alert(1)'), false);
});
