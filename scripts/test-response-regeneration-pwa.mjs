import fs from 'node:fs';
import assert from 'node:assert/strict';
const sw=fs.readFileSync('public/sw-policy.js','utf8');
assert.doesNotMatch(sw,/response-regeneration/);
assert.match(sw,/SHELL_ASSETS/);
console.log('response data is not a pwa shell asset contract ok');