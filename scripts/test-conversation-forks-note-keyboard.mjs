import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/event\.key === 'Enter'/);
assert.match(s,/tagName !== 'INPUT'/);
assert.match(s,/tagName !== 'TEXTAREA'/);
console.log('conversation fork note Enter behavior: ok');