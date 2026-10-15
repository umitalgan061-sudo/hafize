import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/querySelectorAll\('\.message'\)/); assert.match(s,/data-conversation-fork/);
assert.match(s,/Buradan dallandır/);
console.log('conversation fork message actions: ok');