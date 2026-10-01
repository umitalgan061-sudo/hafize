import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/settings-privacy.js','utf8');
assert.match(s,/surface\.prefix && value\.startsWith\(surface\.prefix\)/);
assert.match(s,/surface\.prefix \? String\(key \|\| ''\)\.startsWith\(surface\.prefix\)/);
assert.ok(s.includes('hafize.prompt-library.smart-fill.v1.'));
console.log('privacy prefix contract ok');
