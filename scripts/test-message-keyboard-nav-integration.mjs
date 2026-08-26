import assert from 'node:assert/strict';
import fs from 'node:fs';

const feature = fs.readFileSync(new URL('../public/message-keyboard-nav.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.ok(loader.includes("loadShellEnhancement('HafizeMessageKeyboardNav', '/message-keyboard-nav.js', 'data-hafize-message-keyboard-nav')"));
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.ok(sw.includes("'/message-keyboard-nav.js'"));
assert.ok(sw.includes("if (pathname.startsWith('/api/')) return 'network-only';"));
assert.ok(feature.includes("'.message[data-message-id]'"));
assert.ok(feature.includes('else article.tabIndex = -1'));
assert.ok(feature.includes('if (messages.length && !activeFound) messages[0].tabIndex = 0'));
assert.ok(feature.includes("article.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })"));
assert.ok(feature.includes("container.addEventListener('keydown', onKeyDown)"));
assert.ok(feature.includes("container.addEventListener('focusin', onFocusIn)"));

console.log('message keyboard navigation integration tests passed');