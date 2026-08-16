import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, policy] = await Promise.all([
  readFile(new URL('../public/hands-free.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8')
]);

assert.match(source, /SESSION_LIMIT_MS = 30 \* 60 \* 1000/);
assert.match(source, /POST_OUTPUT_COOLDOWN_MS = 1800/);
assert.match(source, /30 dakikalık güvenlik süresi sonunda kapatıldı/);
assert.match(source, /Yankı koruması etkin/);
assert.match(source, /documentRef\.hidden/);
assert.match(source, /voiceOutputSpeaking/);
assert.match(source, /clearSessionTimer\(\)/);
assert.match(source, /clearCooldown\(\)/);
assert.match(policy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v58`/);
assert.match(policy, /'\/hands-free\.js'/);
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
  /\.submit\s*\(/
]) {
  assert.doesNotMatch(source, forbidden);
}

console.log('hands-free session safety integration tests passed');
