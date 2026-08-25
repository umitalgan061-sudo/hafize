import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/hands-free.js', import.meta.url), 'utf8');
const consentSource = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');
const voiceOutputSource = await readFile(new URL('../public/voice-output.js', import.meta.url), 'utf8');
const swPolicySource = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(source, /NETWORK_RETRY_DELAYS_MS\s*=\s*Object\.freeze\(\[2_000, 5_000, 15_000, 30_000, 60_000\]\)/);
assert.match(source, /networkErrorStreak\s*>\s*NETWORK_RETRY_DELAYS_MS\.length/);
assert.match(source, /disableForRecognitionError\('network'\)/);
assert.match(source, /'audio-capture'/);
assert.match(source, /'service-not-allowed'/);
assert.match(source, /'language-not-supported'/);
assert.match(source, /const wasSpeaking = voiceOutputSpeaking/);
assert.match(source, /else if \(wasSpeaking\)\s*{\s*beginPostOutputCooldown\(\)/s);
assert.doesNotMatch(source, /else\s*{\s*beginPostOutputCooldown\(\);\s*}\s*render\(\);\s*}\s*\n\s*toggle\.addEventListener/s);

for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/i,
  /document\.cookie/,
  /navigator\.clipboard/,
  /requestSubmit\s*\(/,
  /\.submit\s*\(/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /shell\s*:\s*true/i,
  /Authorization/i,
  /Bearer\s+/i,
  /API[_-]?KEY/i
]) {
  assert.doesNotMatch(source, forbidden, `hands-free runtime must not gain forbidden capability: ${forbidden}`);
}

assert.match(source, /micButton\.click\?\.\(\)/, 'wake handoff may only reuse the existing visible voice-input control');
assert.doesNotMatch(source, /sendButton\.click/);
assert.doesNotMatch(source, /composer.*click/i);
assert.doesNotMatch(source, /messageInput\.value\s*=/);

assert.match(consentSource, /Onayla ve dinlemeyi aç/);
assert.match(consentSource, /CONSENT_TIMEOUT_MS/);
assert.match(consentSource, /visibilitychange/);
assert.doesNotMatch(source, /CONSENT_TIMEOUT_MS\s*=/, 'lifecycle recovery must not bypass the separate explicit consent layer');

assert.match(voiceOutputSource, /VOICE_INPUT_STATE_EVENT/);
assert.match(
  voiceOutputSource,
  /function setVoiceInputListening\(next\)[\s\S]*?if \(voiceInputListening\) cancelSpeech\(\{ renderState: false }\)/,
  'voice input activation must cancel speech before rendering the listening state'
);
assert.match(voiceOutputSource, /visibilitychange/);
assert.match(voiceOutputSource, /composer\?\.addEventListener\?\.\('submit'/);

assert.match(swPolicySource, /const CURRENT_CACHE = `\$\{CACHE_PREFIX}v\d+`/);
assert.match(swPolicySource, /'\/hands-free\.js'/);
assert.match(swPolicySource, /pathname\.startsWith\('\/api\/'\).*network-only/s);

assert.equal(registry.agents.length, 4, 'hands-free lifecycle changes must not mutate the selective four-agent roster');
assert.equal(registry.agents.filter((agent) => agent.role === 'selector').length, 2);
assert.equal(registry.agents.filter((agent) => agent.role === 'specialist').length, 2);
assert.equal(registry.defaults.externalWritesRequireApproval, true);
assert.equal(registry.defaults.secretsNeverEnterAgentContext, true);
assert.equal(registry.defaults.sharedTraceIdRequired, true);

for (const agent of registry.agents) {
  assert.equal(agent.toolPolicy?.denyByDefault, true, `${agent.id} must remain backend default-deny`);
}

const publicMessages = [...source.matchAll(/announce\('([^']+)'\)/g)].map((match) => match[1]);
assert.ok(publicMessages.length >= 3);
for (const message of publicMessages) {
  assert.ok(message.length <= 240);
  assert.doesNotMatch(message, /token|cookie|credential|secret|stack|exception|provider/i);
}

assert.match(source, /SESSION_LIMIT_MS\s*=\s*30 \* 60 \* 1000/);
assert.match(source, /expireSession/);
assert.match(source, /documentRef\.hidden/);
assert.match(source, /input\.disabled/);
assert.match(source, /stopRecognition\(\{ abort: true }\)/);
assert.match(source, /destroy\(\)/);
assert.match(source, /removeEventListener/);
assert.match(source, /observer\?\.disconnect/);

console.log('hands-free lifecycle security checks passed');
