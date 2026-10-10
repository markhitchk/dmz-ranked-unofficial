import assert from 'node:assert/strict';
import test from 'node:test';
import { nextHeaderMetaIndex } from '../src/motion/headerMetadata.ts';
test('header metadata cycles without immediate repetition',()=>{
  assert.equal(nextHeaderMetaIndex(-1,2),0);
  assert.equal(nextHeaderMetaIndex(0,2),1);
  assert.equal(nextHeaderMetaIndex(1,2),0);
  assert.equal(nextHeaderMetaIndex(3,1),0);
  assert.equal(nextHeaderMetaIndex(3,0),0);
});
