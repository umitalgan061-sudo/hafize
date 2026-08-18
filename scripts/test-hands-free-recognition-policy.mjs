import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handsFree = require('../public/hands-free.js');

assert.deepEqual(
  handsFree.NETWORK_RETRY_DELAYS_MS,
  [2_000, 5_000, 15_000, 30_000, 60_000],
  'network retries must use the bounded production backoff schedule'
);
assert.ok(Object.isFrozen(handsFree.NETWORK_RETRY_DELAYS_MS));
assert.equal(handsFree.RESTART_DELAY_MS, 350);
assert.equal(handsFree.POST_OUTPUT_COOLDOWN_MS, 1_800);
assert.equal(handsFree.SESSION_LIMIT_MS, 30 * 60 * 1_000);

const cases = [
  ['aborted', 'aborted'],
  [' ABORTED ', 'aborted'],
  ['no-speech', 'idle'],
  ['NO_SPEECH', 'idle'],
  ['network', 'network'],
  ['NETWORK', 'network'],
  ['audio-capture', 'terminal'],
  ['not-allowed', 'terminal'],
  ['security', 'terminal'],
  ['service-not-allowed', 'terminal'],
  ['language-not-supported', 'terminal'],
  ['mystery-provider-error', 'terminal'],
  [null, 'terminal']
];

for (const [value, expectedKind] of cases) {
  const result = handsFree.classifyRecognitionError(value);
  assert.equal(result.kind, expectedKind, `unexpected classification for ${String(value)}`);
  assert.ok(Object.isFrozen(result));
  assert.match(result.code, /^[a-z0-9-]+$/);
}

assert.equal(handsFree.normalizeRecognitionError(' NO_SPEECH '), 'no-speech');
assert.equal(handsFree.normalizeRecognitionError(undefined), 'unknown');
assert.equal(handsFree.normalizeRecognitionError('SERVICE_NOT_ALLOWED'), 'service-not-allowed');

assert.equal(handsFree.networkRetryDelay(0), 0);
assert.equal(handsFree.networkRetryDelay(-1), 0);
assert.equal(handsFree.networkRetryDelay(1.5), 0);
assert.equal(handsFree.networkRetryDelay(1), 2_000);
assert.equal(handsFree.networkRetryDelay(2), 5_000);
assert.equal(handsFree.networkRetryDelay(3), 15_000);
assert.equal(handsFree.networkRetryDelay(4), 30_000);
assert.equal(handsFree.networkRetryDelay(5), 60_000);
assert.equal(handsFree.networkRetryDelay(6), 60_000);
assert.equal(handsFree.networkRetryDelay(10_000), 60_000);

const terminalMessages = [
  ['audio-capture', /mikrofonu kullanamadı/i],
  ['not-allowed', /mikrofon izni/i],
  ['service-not-allowed', /mikrofon izni/i],
  ['security', /mikrofon izni/i],
  ['language-not-supported', /dili.*desteklenmiyor/i],
  ['unknown', /hata.*kapatıldı/i]
];
for (const [code, pattern] of terminalMessages) {
  const message = handsFree.terminalRecognitionMessage(code);
  assert.match(message, pattern);
  assert.ok(message.length <= 140, 'public recovery messages should remain bounded');
  assert.doesNotMatch(message, /stack|token|cookie|credential|exception|provider/i);
}

assert.equal(handsFree.containsWakePhrase('Merhaba Hafize nasılsın?'), true);
assert.equal(handsFree.containsWakePhrase('hafizeci'), false);
assert.equal(handsFree.containsWakePhrase('<script>HAFİZE</script>'), true);
assert.equal(handsFree.containsWakePhrase('başka bir kelime'), false);

const recognitionEvent = {
  resultIndex: 1,
  results: [
    [{ transcript: 'ignored' }],
    [{ transcript: 'Hafize' }],
    [{ transcript: 'yardım et' }]
  ]
};
assert.equal(handsFree.readRecognitionText(recognitionEvent), 'Hafize yardım et');
assert.equal(handsFree.readRecognitionText({}), '');

assert.equal(typeof handsFree.installHandsFree, 'function');
assert.equal(handsFree.getRecognitionConstructor({ SpeechRecognition() {} }) != null, true);
assert.equal(handsFree.getRecognitionConstructor({ webkitSpeechRecognition() {} }) != null, true);
assert.equal(handsFree.getRecognitionConstructor({}), null);

console.log('hands-free recognition policy checks passed');
