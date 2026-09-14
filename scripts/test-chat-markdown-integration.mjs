import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const policy = readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const appIndex = index.indexOf('<script src="/app.js" defer></script>');
const markdownIndex = index.indexOf('<script src="/chat-markdown.js" defer></script>');
assert.ok(appIndex >= 0);
assert.ok(markdownIndex > appIndex);
assert.equal((index.match(/chat-markdown\.js/g) || []).length, 1);
assert.equal((index.match(/chat-markdown\.css/g) || []).length, 1);

assert.match(app, /textContent = message\.content \|\| '…'/);
assert.match(renderer, /\.message\.assistant \.content/);
assert.doesNotMatch(renderer, /\.message\.user \.content/);
assert.match(renderer, /MutationObserver/);
assert.match(renderer, /markdownSource/);
assert.match(renderer, /markdownWriting/);
assert.match(policy, /\/chat-markdown\.js/);
assert.match(policy, /\/chat-markdown\.css/);
assert.match(policy, /v24/);

assert.doesNotMatch(renderer, /fetch\s*\(/);
assert.doesNotMatch(renderer, /XMLHttpRequest/);
assert.doesNotMatch(renderer, /WebSocket/);
assert.doesNotMatch(renderer, /document\.cookie/);

console.log('test-chat-markdown-integration: ok');
