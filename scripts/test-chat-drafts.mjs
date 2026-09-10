import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('public/index.html');
const js = read('public/chat-drafts.js');
const css = read('public/chat-drafts.css');
const sw = read('public/sw-policy.js');

assert.match(html, /chat-drafts\.css/);
assert.match(html, /chat-drafts\.js/);
assert.match(js, /hafize\.chat-drafts\.v1/);
assert.match(js, /MAX_DRAFT_LENGTH = 12000/);
assert.match(js, /MAX_DRAFTS = 30/);
assert.match(js, /SAVE_DELAY = 250/);
assert.match(js, /localStorage\.getItem/);
assert.match(js, /localStorage\.setItem/);
assert.match(js, /activeConversationId/);
assert.match(js, /MutationObserver/);
assert.match(js, /addEventListener\('storage'/);
assert.match(js, /addEventListener\('submit'/);
assert.match(js, /clearDraft/);
assert.match(js, /restoreDraft/);
assert.match(js, /pagehide/);
assert.match(js, /visibilitychange/);
assert.match(css, /chat-draft-status/);
assert.match(css, /max-width: 680px/);
assert.match(sw, /\/chat-drafts\.css/);
assert.match(sw, /\/chat-drafts\.js/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v21`/);

console.log('chat drafts source-contract checks passed');
