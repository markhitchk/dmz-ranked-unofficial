import assert from 'node:assert/strict';
import test from 'node:test';
import { settingsEntryState, shouldStartSettingsEntry } from '../src/motion/settingsMotion.ts';
test('Settings entrance fires on open, never on query changes', () => {
  assert.equal(shouldStartSettingsEntry(false,true,true), true);
  assert.equal(shouldStartSettingsEntry(true,true,true), false);
  assert.equal(shouldStartSettingsEntry(false,true,false), false);
  assert.equal(shouldStartSettingsEntry(true,false,true), false);
});
test('Settings entrance snaps to visible final state without animations', () => {
  assert.deepEqual(settingsEntryState(true,true),{opacity:0,searchOffsetY:-10,contentOffsetY:18});
  assert.deepEqual(settingsEntryState(true,false),{opacity:1,searchOffsetY:0,contentOffsetY:0});
});
