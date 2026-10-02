import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/if \(article\.querySelector\('\[data-conversation-fork\]'\)\) return/);
assert.match(s,/if \(mounted\) return/);
console.log('conversation fork idempotent mounting: ok');