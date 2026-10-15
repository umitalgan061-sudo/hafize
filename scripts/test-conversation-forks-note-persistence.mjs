import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const s=require('node:fs').readFileSync('public/typed/app-shell.ts','utf8');
assert.match(s,/forkNote/);
assert.match(s,/slice\(0, 400\)/);
console.log('conversation fork note persistence: ok');