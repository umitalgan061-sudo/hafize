import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/hands-free.js', import.meta.url));
const source = await readFile(sourcePath, 'utf8');

assert.equal(/localStorage|sessionStorage|document\.cookie/.test(source), false,
  'hands-free enablement must remain session-scoped and must not persist microphone opt-in');
assert.equal(source.includes("const HANDOFF_TIMEOUT_MS = 1500;"), true,
  'voice handoff must keep a bounded fallback');
assert.equal(source.includes("const VOICE_INPUT_STATE_EVENT = 'hafize:voice-input-state';"), true);
assert.equal(source.includes("detail.source !== 'voice-input'"), true,
  'only the explicit voice-input lifecycle event may confirm microphone handoff');
assert.equal(source.includes('handoffWaiting || voiceInputListening'), true,
  'wake recognition must not restart while handoff or voice input owns the microphone');
assert.equal(source.includes("indicator.setAttribute?.('data-handoff-waiting'"), true,
  'handoff state must remain observable in the visible status UI');
assert.equal(source.includes("documentRef.addEventListener?.('visibilitychange'"), true);
assert.equal(source.includes('stopRecognition({ abort: true })'), true,
  'hidden/disabled/destroy paths must be able to abort recognition');
assert.equal(/shell\s*=\s*true|child_process|exec\(|spawn\(/.test(source), false,
  'hands-free browser code must never gain terminal execution');
assert.equal(/NVIDIA_API_KEY|HAFIZE_CONNECTOR_AUTH_TOKEN|CLIENT_SECRET/.test(source), false,
  'hands-free browser code must not contain server credentials');

console.log('hands-free source boundary tests passed');
