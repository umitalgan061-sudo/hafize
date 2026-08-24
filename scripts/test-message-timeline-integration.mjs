import assert from 'node:assert/strict';
import fs from 'node:fs';

const timeline = fs.readFileSync(new URL('../public/message-timeline.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

assert.ok(loader.includes("loadShellEnhancement('HafizeMessageTimeline', '/message-timeline.js', 'data-hafize-message-timeline')"));
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.ok(sw.includes("'/message-timeline.js'"));
assert.ok(sw.includes("if (pathname.startsWith('/api/')) return 'network-only';"));

assert.ok(app.includes("const STORAGE_KEY = 'hafize.conversations.v1';"));
assert.ok(app.includes("const message = { id: uid(), role, content, at: new Date().toISOString() };"));
assert.ok(app.includes('article.dataset.messageId = message.id;'));

assert.ok(timeline.includes("const STORAGE_KEY = 'hafize.conversations.v1';"));
assert.ok(timeline.includes('.message[data-message-id]'));
assert.ok(timeline.includes("role', 'separator'"));
assert.ok(timeline.includes("aria-label', `Gönderim zamanı: ${time.title}`"));
assert.ok(timeline.includes("windowRef?.addEventListener?.('storage', onStorage)"));
assert.ok(timeline.includes('MAX_CONVERSATIONS = 30'));
assert.ok(timeline.includes('MAX_MESSAGES_PER_CONVERSATION = 200'));

console.log('message timeline integration tests passed');
