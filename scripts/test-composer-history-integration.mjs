import assert from 'node:assert/strict';
import fs from 'node:fs';

const feature = fs.readFileSync(new URL('../public/composer-history.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(loader, /HafizeComposerHistory/);
assert.match(loader, /\/composer-history\.js/);
assert.match(loader, /data-hafize-composer-history/);
assert.match(sw, /hafize-shell-v40/);
assert.match(sw, /'\/composer-history\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);

assert.match(feature, /#messageInput/);
assert.match(feature, /#messages/);
assert.match(feature, /\.message\.user/);
assert.doesNotMatch(feature, /\.message\.assistant/);
assert.doesNotMatch(feature, /tool-activities/);
assert.doesNotMatch(feature, /data-message-id/);
assert.doesNotMatch(feature, /agentId/);
assert.match(feature, /event\.isComposing/);
assert.match(feature, /event\.repeat/);
assert.match(feature, /selectionStart/);
assert.match(feature, /selectionEnd/);
assert.match(feature, /aria-live/);
assert.match(feature, /aria-atomic/);

for (const token of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon',
  'localStorage', 'sessionStorage', 'document.cookie', 'navigator.clipboard',
  'requestSubmit', '.submit(', 'window.open', 'location.href', 'eval('
]) assert.equal(feature.includes(token), false, `forbidden integration token: ${token}`);

console.log('composer history integration ok');
