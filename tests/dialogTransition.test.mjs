import assert from 'node:assert/strict';
import test from 'node:test';
import { nextDialogPhase } from '../src/motion/dialogTransition.ts';
test('dialog enters and exits in an explicit order',()=>{
  assert.equal(nextDialogPhase('hidden','open'),'entering');
  assert.equal(nextDialogPhase('entering','entered'),'shown');
  assert.equal(nextDialogPhase('shown','close'),'exiting');
  assert.equal(nextDialogPhase('exiting','exited'),'hidden');
});
test('reopening while closing cancels old exit completion',()=>{
  assert.equal(nextDialogPhase('exiting','open'),'entering');
  assert.equal(nextDialogPhase('entering','exited'),'entering');
  assert.equal(nextDialogPhase('exiting','close'),'exiting');
  assert.equal(nextDialogPhase('hidden','close'),'hidden');
});
