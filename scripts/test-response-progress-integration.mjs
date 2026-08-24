import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [loader, policy, source] = await Promise.all([
  readFile(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/response-progress.js', import.meta.url), 'utf8')
]);

assert.match(loader, /HafizeResponseProgress/);
assert.match(loader, /\/response-progress\.js/);
assert.match(loader, /data-hafize-response-progress/);
assert.match(policy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(policy, /'\/response-progress\.js'/);
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
]) assert.doesNotMatch(source, forbidden);

assert.match(source, /aria-busy/);
assert.match(source, /role', 'status'/);
assert.match(source, /aria-live', 'polite'/);
assert.match(source, /prefers-reduced-motion:no-preference/);
assert.match(source, /observer\.observe\(sendButton/);
assert.match(source, /observer\.observe\(messages/);

console.log('response progress integration tests passed');
