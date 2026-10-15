import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/comparisonData/);
assert.match(s,/openComparison/);
assert.match(s,/Dal karşılaştırması/);
assert.match(s,/Ortak başlangıç/);
console.log('conversation fork comparison: ok');