import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationTabScale } from '../src/motion/notificationMotion.ts';
test('notification tabs do not move with disabled motion',()=>{
  assert.equal(notificationTabScale(false,false),1);
  assert.equal(notificationTabScale(true,false),1);
  assert.equal(notificationTabScale(true,true),1);
  assert.equal(notificationTabScale(false,true),0.985);
});
