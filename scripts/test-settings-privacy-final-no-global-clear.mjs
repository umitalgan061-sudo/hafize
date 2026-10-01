import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/settings-privacy.js','utf8');
assert.equal(s.includes('.clear()'),false);
assert.equal(s.includes('localStorage.clear('),false);
assert.equal(s.includes('sessionStorage.clear('),false);
console.log('privacy global clear gate ok');
