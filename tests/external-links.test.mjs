import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/screens/DmzWebScreen.tsx', import.meta.url),
  'utf8'
);

function extractFunction(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' must exist');
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('Could not extract ' + name);
}

test('external website routing accepts arbitrary HTTP and HTTPS destinations', () => {
  const context = vm.createContext({ URL });
  vm.runInContext(extractFunction('isAllowedExternal').replace('(url: string): boolean', '(url)'), context);

  assert.equal(context.isAllowedExternal('https://dmz-ticker.netlify.app/'), true);
  assert.equal(context.isAllowedExternal('https://dmz-themed-obs.netlify.app/'), true);
  assert.equal(context.isAllowedExternal('https://youtube.com/watch?v=abc'), true);
  assert.equal(context.isAllowedExternal('http://example.com/path'), true);
});

test('external website routing rejects non-web and malformed destinations', () => {
  const context = vm.createContext({ URL });
  vm.runInContext(extractFunction('isAllowedExternal').replace('(url: string): boolean', '(url)'), context);

  assert.equal(context.isAllowedExternal('javascript:alert(1)'), false);
  assert.equal(context.isAllowedExternal('file:///tmp/test.html'), false);
  assert.equal(context.isAllowedExternal('intent://example.com/#Intent;end'), false);
  assert.equal(context.isAllowedExternal('not a url'), false);
});

test('DMZ Ranked remains the in-app WebView origin', () => {
  const context = vm.createContext({ URL });
  vm.runInContext(extractFunction('isInternal').replace('(url: string): boolean', '(url)'), context);

  assert.equal(context.isInternal('https://dmzranked.com/'), true);
  assert.equal(context.isInternal('https://www.dmzranked.com/path'), true);
  assert.equal(context.isInternal('https://dmz-ticker.netlify.app/'), false);
});
