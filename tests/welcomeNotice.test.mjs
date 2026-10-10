import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWelcomeNotice } from '../src/services/welcomeNotice.ts';

test('Beta welcome includes the actual version, build, operator and beta-only disclaimer', () => {
  const notice = buildWelcomeNotice({
    channel: 'beta',
    version: '1.1.0',
    build: '184',
    operatorName: 'HarleyTG'
  });
  assert.equal(notice.id, 'welcome_beta_1_1_0_184');
  assert.match(notice.title, /\[System\].*BETA/);
  assert.match(notice.body, /Welcome, @HarleyTG!/);
  assert.match(notice.body, /v1\.1\.0 \(Build 184\)/);
  assert.match(notice.body, /Beta-only/);
  assert.match(notice.body, /Stable release/);
});

test('Stable copy is dynamic and never promises experimental beta features', () => {
  const notice = buildWelcomeNotice({
    channel: 'stable',
    version: '2.0.0',
    build: '201',
    operatorName: 'Ranger'
  });
  assert.equal(notice.id, 'welcome_stable_2_0_0_201');
  assert.match(notice.body, /Welcome, @Ranger!/);
  assert.match(notice.body, /v2\.0\.0 \(Build 201\).*STABLE/);
  assert.doesNotMatch(notice.body, /Beta-only/);
  assert.doesNotMatch(notice.title, /BETA/);
});

test('Guest fallback is shown when an operator is not selected', () => {
  const message = buildWelcomeNotice({
    channel: 'beta', version: '1.1.0', build: '184', operatorName: ' '
  });
  assert.match(message.body, /Welcome, @Guest!/);
});

test('Updating the selected operator does not create another welcome notification', () => {
  const base = { channel: 'beta', version: '1.1.0', build: '184' };
  const guest = buildWelcomeNotice({ ...base, operatorName: '' });
  const signedIn = buildWelcomeNotice({ ...base, operatorName: '@NewOperator' });
  assert.equal(guest.id, signedIn.id);
  assert.match(signedIn.body, /Welcome, @NewOperator!/);
  assert.notEqual(guest.body, signedIn.body);
  assert.notEqual(guest.id, buildWelcomeNotice({ ...base, build: '185' }).id);
});

test('Operator names are normalized to one visible line', () => {
  const message = buildWelcomeNotice({
    channel: 'stable',
    version: '1.1.0',
    build: '181',
    operatorName: '@Ranger\nInjected'
  });
  assert.match(message.body, /Welcome, @Ranger Injected!/);
  assert.doesNotMatch(message.body, /@@/);
});
