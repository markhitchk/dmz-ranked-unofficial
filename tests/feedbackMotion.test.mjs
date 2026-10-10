import assert from 'node:assert/strict';
import test from 'node:test';
import { feedbackEntryEnabled } from '../src/motion/feedbackMotion.ts';
test('Feedback entry respects disabled animations and visibility',()=>{
  assert.equal(feedbackEntryEnabled(true,{enabled:true,loopsEnabled:true}),true);
  assert.equal(feedbackEntryEnabled(false,{enabled:true,loopsEnabled:true}),false);
  assert.equal(feedbackEntryEnabled(true,{enabled:false,loopsEnabled:false}),false);
});
