import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-organize.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'public/conversation-organize.js'), 'utf8');
const swPolicy = fs.readFileSync(path.join(root, 'public/sw-policy.js'), 'utf8');

assert.equal(api.SOURCE_KEY, 'hafize.conversations.v1');
assert.equal(api.STORAGE_KEY, 'hafize.conversation-organize.v1');
assert.equal(api.MAX_ENTRIES, 30);
assert.equal(api.MAX_SESSION_MUTATIONS, 30);
assert.equal(api.MAX_TITLE_CHARS, 80);

assert.match(source, /const ACTIVE_LISTS = new WeakSet\(\)/, 'one controller owns each conversation list');
assert.match(source, /if \(!list \|\| ACTIVE_LISTS\.has\(list\)\) return null/, 'duplicate install fails closed');
assert.match(source, /function isLive\(\)/, 'side effects are gated by live ownership');
assert.match(source, /if \(!isLive\(\)\) return false;\n\s*const normalized = normalizeEntries\(next\)/, 'persistence requires live controller');
assert.match(source, /storage\?\.setItem\?\.\(STORAGE_KEY/, 'writes remain scoped to organize metadata key');
assert.doesNotMatch(source, /storage\?\.setItem\?\.\(SOURCE_KEY/, 'controller never rewrites canonical conversation storage');
assert.match(source, /ownedActions = new Map\(\)/);
assert.match(source, /rowSnapshots = new Map\(\)/);
assert.match(source, /cancelPending\(\)/);
assert.match(source, /ACTIVE_LISTS\.delete\(list\)/, 'teardown releases ownership');
assert.match(source, /restoreRow\(row, snapshot\)/, 'host row state is restored');
assert.match(source, /if \(isLive\(\)\) renderNow\(\)/, 'deferred callback rechecks liveness');

for (const forbidden of [
  'fetch(',
  'XMLHttpRequest',
  'navigator.clipboard',
  'requestSubmit(',
  'memory.write',
  'external.send',
  'repo.merge',
  'shell=True'
]) {
  assert.equal(source.includes(forbidden), false, `organize UI must not gain capability: ${forbidden}`);
}

assert.match(swPolicy, /const CURRENT_CACHE = `\$\{CACHE_PREFIX\}v165`;/);
assert.match(swPolicy, /'\/conversation-organize\.js'/);
assert.match(swPolicy, /'\/conversation-organize\.css'/);

console.log('conversation organize security contract tests passed');