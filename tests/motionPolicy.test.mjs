import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveMotionPolicy, MOTION, pressScaleTarget } from '../src/motion/motionPolicy.ts';

test('policy respects setting, reduced motion, and background lifecycle', () => {
  for (const setting of [false, true]) {
    for (const reduced of [false, true]) {
      for (const active of [false, true]) {
        const expected = setting && !reduced;
        assert.deepEqual(deriveMotionPolicy(setting, reduced, active), {
          enabled: expected, loopsEnabled: expected && active
        });
      }
    }
  }
});

test('native press target ignores disabled and reduced motion', () => {
  assert.equal(pressScaleTarget(true, false, true), 0.97);
  assert.equal(pressScaleTarget(false, false, true), 1);
  assert.equal(pressScaleTarget(true, true, true), 1);
  assert.equal(pressScaleTarget(true, false, false), 1);
  assert.equal(MOTION.pressInMs, 90);
  assert.equal(MOTION.settingsSearchMs, 180);
  assert.equal(MOTION.settingsContentMs, 240);
  assert.equal(MOTION.dialogCloseMs, 150);
});
