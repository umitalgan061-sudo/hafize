import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [indexHtml, voiceSource, handsFreeSource, outputSource] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/voice-input.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/hands-free.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/voice-output.js', import.meta.url), 'utf8')
]);

const voiceScript = indexHtml.indexOf('<script src="/voice-input.js" defer></script>');
const handsFreeScript = indexHtml.indexOf('<script src="/hands-free.js" defer></script>');
assert.ok(voiceScript >= 0, 'voice input browser script must remain wired');
assert.ok(handsFreeScript > voiceScript, 'voice input must load before hands-free handoff consumer');

for (const source of [voiceSource, handsFreeSource]) {
  assert.match(source, /hafize:voice-input-state/);
}
assert.match(voiceSource, /source:\s*'voice-input'/);
assert.match(voiceSource, /dispatchVoiceInputState\(documentRef, root, listening\)/);
assert.match(handsFreeSource, /detail\.source !== 'voice-input'/);
assert.match(handsFreeSource, /voiceInputListening/);
assert.match(handsFreeSource, /stopRecognition\(\{ abort: true \}\)/);
assert.match(handsFreeSource, /scheduleRestart\(\)/);

// Voice capture only fills the composer. Sending remains an explicit form action.
assert.doesNotMatch(voiceSource, /requestSubmit|\.submit\s*\(/);
assert.doesNotMatch(handsFreeSource, /requestSubmit|\.submit\s*\(/);
assert.match(voiceSource, /input\.value = mergeTranscript/);

// Barge-in remains active: opening the mic must cancel any ongoing TTS.
assert.match(outputSource, /aria-pressed/);
assert.match(outputSource, /cancelSpeech\(\)/);

// Hidden tabs must not keep wake recognition alive.
assert.match(handsFreeSource, /documentRef\.hidden/);
assert.match(handsFreeSource, /handleVisibility/);

console.log('voice handoff browser wiring tests passed');
