import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const voiceOutputPath = fileURLToPath(new URL('../public/voice-output.js', import.meta.url));
const handsFreePath = fileURLToPath(new URL('../public/hands-free.js', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/VOICE_INTERACTION_SECURITY.md', import.meta.url));
const [voiceOutput, handsFree, securityDoc] = await Promise.all([
  readFile(voiceOutputPath, 'utf8'),
  readFile(handsFreePath, 'utf8'),
  readFile(docPath, 'utf8')
]);

const eventName = 'hafize:voice-output-state';
assert.equal(voiceOutput.includes(`const VOICE_OUTPUT_STATE_EVENT = '${eventName}'`), true);
assert.equal(handsFree.includes(`const VOICE_OUTPUT_STATE_EVENT = '${eventName}'`), true);
assert.equal(securityDoc.includes(eventName), true);

assert.match(voiceOutput, /source:\s*'voice-output'/);
for (const field of ['state', 'speaking', 'thinking', 'enabled', 'supported']) {
  assert.equal(voiceOutput.includes(field), true, `voice output state contract must retain ${field}`);
}
assert.equal(/detail:\s*Object\.freeze\([^)]*(content|text|token|credential|ownerId)/s.test(voiceOutput), false,
  'voice output status event must not carry assistant text or credential-shaped fields');

assert.equal(handsFree.includes("detail.source !== 'voice-output'"), true,
  'hands-free must validate voice output event provenance');
assert.equal(handsFree.includes("typeof detail.speaking !== 'boolean'"), true,
  'hands-free must fail closed on malformed speaking state');
assert.equal(handsFree.includes('voiceOutputSpeaking || documentRef.hidden || input.disabled'), true,
  'wake restart must stay blocked while Hafize TTS is speaking');
assert.equal(handsFree.includes('if (voiceOutputSpeaking || !containsWakePhrase'), true,
  'late recognition results must not self-wake during TTS');
assert.equal(handsFree.includes("documentRef.addEventListener?.(VOICE_OUTPUT_STATE_EVENT, handleVoiceOutputState)"), true);
assert.equal(handsFree.includes("documentRef.removeEventListener?.(VOICE_OUTPUT_STATE_EVENT, handleVoiceOutputState)"), true);

assert.equal(voiceOutput.includes('let speechGeneration = 0;'), true);
assert.equal(voiceOutput.includes('generation !== speechGeneration || activeUtterance !== utterance'), true,
  'stale utterance callbacks must be generation and identity guarded');
assert.equal(voiceOutput.includes('speechGeneration += 1;'), true);

const forbidden = [
  /child_process/,
  /execSync\s*\(/,
  /spawnSync\s*\(/,
  /shell\s*:\s*true/,
  /NVIDIA_API_KEY/,
  /HAFIZE_CONNECTOR_AUTH_TOKEN/,
  /HAFIZE_CLOUD_SESSION_SIGNING_KEY/,
  /document\.cookie/,
  /innerHTML\s*=/
];
for (const source of [voiceOutput, handsFree]) {
  for (const pattern of forbidden) assert.equal(pattern.test(source), false, `forbidden voice runtime pattern: ${pattern}`);
}

for (const storagePattern of [
  /localStorage[^\n]{0,120}hands.?free/i,
  /sessionStorage[^\n]{0,120}hands.?free/i,
  /hafize\.handsFree/i
]) {
  assert.equal(storagePattern.test(handsFree), false, 'hands-free microphone opt-in must remain session-scoped');
}

assert.match(securityDoc, /Echo \/ self-wake engeli/);
assert.match(securityDoc, /TTS generation izolasyonu/);
assert.match(securityDoc, /agent\/tool permission üretmez/);

console.log('voice interaction source boundary tests passed');
