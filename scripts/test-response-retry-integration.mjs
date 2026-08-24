import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [moduleSource, loaderSource, policySource, cssSource, styleSource, appSource] = await Promise.all([
  readFile(new URL('../public/response-retry.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/response-retry.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/response-retry-style.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8')
]);

assert.match(loaderSource, /HafizeResponseRetryStyle/);
assert.match(loaderSource, /\/response-retry-style\.js/);
assert.match(loaderSource, /HafizeResponseRetry/);
assert.match(loaderSource, /\/response-retry\.js/);
assert.match(policySource, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(policySource, /'\/response-retry-style\.js'/);
assert.match(policySource, /'\/response-retry\.js'/);
assert.match(policySource, /'\/response-retry\.css'/);
assert.match(policySource, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.match(styleSource, /\/response-retry\.css/);
assert.match(styleSource, /data-hafize-response-retry-style/);
assert.match(cssSource, /prefers-reduced-motion/);
assert.match(cssSource, /forced-colors/);
assert.match(cssSource, /focus-visible/);
assert.match(cssSource, /min-height:\s*40px/);

assert.match(moduleSource, /#messages/);
assert.match(moduleSource, /#composer/);
assert.match(moduleSource, /#messageInput/);
assert.match(moduleSource, /#sendBtn/);
assert.match(moduleSource, /requestSubmit/);
assert.match(moduleSource, /DRAFT_BLOCKED/);
assert.match(moduleSource, /classList\?\.contains\?\.\('streaming'\)/);
assert.match(moduleSource, /MutationObserver/);
assert.match(moduleSource, /disconnect/);
assert.match(moduleSource, /aria-live/);

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /sendBeacon/,
  /\/api\//,
  /Authorization/i,
  /Bearer\s/i
]) {
  assert.doesNotMatch(moduleSource, forbidden);
}

assert.match(appSource, /composer\.addEventListener\('submit'/);
assert.match(appSource, /submitMessage\(ui\.messageInput\.value\)/);
assert.match(appSource, /runController\.begin\(\)/);
assert.match(appSource, /getActiveConversation\(\)\?\.toolsEnabled/);

console.log('response retry integration tests passed');
