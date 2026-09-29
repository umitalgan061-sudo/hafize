import assert from 'node:assert/strict';
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/if \(article\.querySelector\('\[data-conversation-fork\]'\)\) return/);
assert.match(s,/if \(mounted\) return/);
console.log('conversation fork idempotent mounting: ok');