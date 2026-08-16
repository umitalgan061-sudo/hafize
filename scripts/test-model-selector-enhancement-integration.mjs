import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [loader, policy, moduleSource] = await Promise.all([
  readFile(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/model-selector-enhancement.js', import.meta.url), 'utf8')
]);

assert.match(loader, /HafizeModelSelectorEnhancement/);
assert.match(loader, /\/model-selector-enhancement\.js/);
assert.match(loader, /data-hafize-model-selector-enhancement/);
assert.match(policy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v51`/);
assert.match(policy, /'\/model-selector-enhancement\.js'/);
assert.match(policy, /pathname\.startsWith\('\/api\/'\).*network-only/s);

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /sendBeacon/,
  /\.requestSubmit\s*\(/,
  /\.submit\s*\(/
]) {
  assert.doesNotMatch(moduleSource, forbidden);
}

assert.match(moduleSource, /LOCAL_MODEL_PREFIX = 'local:';/);
assert.match(moduleSource, /addEventListener\?\.\('click', onToolClickCapture, true\)/);
assert.match(moduleSource, /addEventListener\?\.\('submit', blockUnsafeSend, true\)/);
assert.match(moduleSource, /\[data-prompt\]/);
assert.match(moduleSource, /stopImmediatePropagation/);
assert.match(moduleSource, /toolButton\.click\(\)/);

console.log('model selector enhancement integration tests passed');
