import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const outline = require('../public/conversation-outline.js');
const sw = require('../public/sw-policy.js');

const source = await readFile(new URL('../public/conversation-outline.js', import.meta.url), 'utf8');
const docs = await readFile(new URL('../docs/CONVERSATION_OUTLINE_LIFECYCLE_BOUNDARY.md', import.meta.url), 'utf8');

assert.equal(outline.MAX_OUTLINE_ITEMS, 100);
assert.equal(outline.MAX_PREVIEW_CHARS, 92);
assert.equal(outline.MAX_QUERY_CHARS, 120);
assert.equal(outline.MAX_MESSAGE_ID_CHARS, 160);
assert.equal(outline.HIGHLIGHT_MS, 1400);

// Read-only UI boundary: outline must not gain connector, persistence or submit powers.
for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /localStorage/,
  /sessionStorage/,
  /navigator\.clipboard/,
  /requestSubmit\s*\(/,
  /\.submit\s*\(/,
  /indexedDB/,
  /WebSocket/,
  /EventSource/,
  /HafizeMemory/,
  /\/api\//
]) {
  assert.doesNotMatch(source, forbidden);
}

// Lifecycle ownership and deferred-work cancellation are explicit production contracts.
assert.match(source, /const ACTIVE_MESSAGES = new WeakSet\(\)/);
assert.match(source, /ACTIVE_MESSAGES\.has\(messages\)/);
assert.match(source, /ACTIVE_MESSAGES\.add\(messages\)/);
assert.match(source, /ACTIVE_MESSAGES\.delete\(messages\)/);
assert.match(source, /function isLive\(\)/);
assert.match(source, /function rollback\(\)/);
assert.match(source, /cancelRefresh\(\)/);
assert.match(source, /observer\?\.disconnect\?\.\(\)/);
assert.match(source, /destroyed = true/);
assert.match(source, /requestAnimationFrame/);
assert.match(source, /cancelAnimationFrame/);

// Foreign/host DOM must be rejected or preserved instead of silently adopted.
assert.match(source, /#conversationOutlinePanel/);
assert.match(source, /\.conversation-outline-trigger/);
assert.match(source, /owned: false/);
assert.match(source, /if \(ownsStyle\) styleNode\?\.remove\?\.\(\)/);

// Message targeting remains bounded and exact-id based.
assert.match(source, /\.message\.user\[data-message-id\]/);
assert.doesNotMatch(source, /\.message\.assistant\[data-message-id\]/);
assert.equal(outline.normalizeMessageId('../u1'), null);
assert.equal(outline.normalizeMessageId('u1/child'), null);
assert.equal(outline.normalizeMessageId('u1:child'), 'u1:child');
assert.equal(outline.normalizeQuery('x'.repeat(121)), '');
assert.equal(outline.createPreview('x'.repeat(500)).length, 92);

// The cached client must keep a versioned current shell and retire older shell generations.
assert.match(sw.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(sw.SHELL_ASSETS.includes('/conversation-outline.js'), true);
assert.equal(sw.SHELL_ASSETS.includes('/conversation-outline.css'), true);
const staleCache = `${sw.CACHE_PREFIX}v0`;
assert.notEqual(staleCache, sw.CURRENT_CACHE);
assert.equal(sw.shouldDeleteCache(staleCache), true);
assert.equal(sw.shouldDeleteCache(sw.CURRENT_CACHE), false);

// Documentation must record the same non-goals, not imply new permissions.
assert.match(docs, /tek controller/i);
assert.match(docs, /WeakSet/);
assert.match(docs, /fail-closed|fail closed/i);
assert.match(docs, /storage okuyup yazmaz/i);
assert.match(docs, /network\/fetch kullanmaz/i);
assert.match(docs, /tool\/agent permission/i);
assert.match(docs, /tabindex/i);
assert.match(docs, /100 kullanıcı turu/i);

console.log('conversation outline security contract tests passed');
