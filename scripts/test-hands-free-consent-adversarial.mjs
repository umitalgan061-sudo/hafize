import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');

// Consent state may only be driven by the fixed hands-free toggle and fixed review controls.
assert.match(source, /#handsFreeToggle/);
assert.match(source, /#handsFreeIndicator/);
assert.doesNotMatch(source, /dataset\./);
assert.doesNotMatch(source, /location\.|URLSearchParams|postMessage|message event/);
assert.doesNotMatch(source, /eval\(|Function\(|innerHTML|outerHTML|insertAdjacentHTML/);

// No transcript, prompt, model, agent or connector data is read by the review layer.
for (const forbidden of ['messageInput', 'modelSelect', 'agentSelect', 'memory', 'gmail', 'canva', 'github', 'traceId', 'ownerId', 'token']) {
  assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, `review must not inspect ${forbidden}`);
}

// Fixed language tells the user the actual privacy boundary before activation.
assert.match(source, /yalnız bu oturumda/);
assert.match(source, /30 dakika sonra kapanır/);
assert.match(source, /otomatik gönderilmez/);
assert.doesNotMatch(source, /arka planda devam/i);

// Disabled controls and already-active state fail closed / preserve fast shutdown.
assert.match(source, /toggle\.disabled/);
assert.match(source, /destroyed \|\| pending/);
assert.match(source, /destroyed \|\| !pending/);

console.log('hands-free consent adversarial tests passed');
