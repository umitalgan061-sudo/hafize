import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const i=readFileSync('public/index.html','utf8');
assert.ok(i.indexOf('/settings-privacy.css')<i.indexOf('/settings-privacy.js'));
console.log('privacy final index ordering ok');
