import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const consent = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');
const handsFree = await readFile(new URL('../public/hands-free.js', import.meta.url), 'utf8');
const voiceInput = await readFile(new URL('../public/voice-input.js', import.meta.url), 'utf8');

// The consent layer wraps rather than reimplements speech recognition.
assert.doesNotMatch(consent, /SpeechRecognition|webkitSpeechRecognition/);
assert.doesNotMatch(consent, /\.start\(\)|\.stop\(\)|\.abort\(\)/);
assert.match(consent, /toggle\.click\?\.\(\)/);

// Existing hands-free protections remain the authority after confirmation.
assert.match(handsFree, /DEFAULT_WAKE_PHRASE = 'hafize'/);
assert.match(handsFree, /SESSION_LIMIT_MS = 30 \* 60 \* 1000/);
assert.match(handsFree, /POST_OUTPUT_COOLDOWN_MS = 1800/);
assert.match(handsFree, /HANDOFF_TIMEOUT_MS = 1500/);
assert.match(handsFree, /documentRef\.hidden/);
assert.match(handsFree, /voiceOutputSpeaking/);
assert.match(handsFree, /voiceInputListening/);
assert.match(handsFree, /micButton\.click\?\.\(\)/);
assert.match(handsFree, /continuous = true/);
assert.match(handsFree, /interimResults = false/);
assert.match(handsFree, /maxAlternatives = 1/);

// Wake phrase only hands off to explicit voice input; voice input still never submits.
assert.match(voiceInput, /continuous = false/);
assert.match(voiceInput, /interimResults = true/);
assert.match(voiceInput, /metin otomatik gönderilmez/);
assert.doesNotMatch(voiceInput, /requestSubmit\(|submitMessage\(|sendBtn\.click/);

// No provider or tool permission routing is introduced in either microphone layer.
for (const source of [consent, handsFree, voiceInput]) {
  assert.doesNotMatch(source, /NVIDIA_API_KEY|GITHUB_TOKEN|approvalGranted|repo\.merge|external\.send|external\.write/);
}

console.log('hands-free consent runtime contract tests passed');
