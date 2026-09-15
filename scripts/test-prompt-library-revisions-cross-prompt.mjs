import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(s, /revision\.promptId/);
assert.match(s, /items\.find\(\(item\) => item\.id === revision\.promptId\)/);
assert.match(s, /if \(!target\) return \{ ok: false, reason: 'prompt-not-found' \}/);
assert.match(s, /items\.map\(\(item\) => item\.id === target\.id \? next : item\)/);
console.log('revision cross-prompt isolation: ok');
