import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Settings keeps the original virtualized scrolling container', () => {
  const source = read('src/components/SettingsPanel.tsx');
  assert.match(source, /<FlatList\s+style=\{styles\.scroll\}/);
  assert.doesNotMatch(source, /<Animated\.View[^>]*>[\s\S]{0,500}<FlatList/);
});
test('Settings row tap and Switch preserve original independent touch behavior', () => {
  const source = read('src/components/SettingsPanel.tsx');
  assert.match(source, /<Pressable style=\{styles\.toggleCard\} onPress=\{\(\) => onChange\(!value\)\}>/);
  assert.match(source, /<Switch\s+value=\{value\}/);
});
test('Dialogs use prop visibility directly rather than a second mount state', () => {
  const source = read('src/components/DmzDialog.tsx');
  assert.match(source, /<Modal\s+visible=\{visible\}/);
  assert.doesNotMatch(source, /visible=\{mounted\}/);
});
test('Native header and Settings use original Pressable controls', () => {
  for (const file of ['src/components/AppHeader.tsx','src/components/AppMessagesPanel.tsx','src/components/SettingsPanel.tsx']) {
    assert.doesNotMatch(read(file), /MotionPressable/);
  }
});
