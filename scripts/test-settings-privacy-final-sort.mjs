import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/settings-privacy.js','utf8');
assert.ok(s.includes("sort.value === 'size'"));
assert.ok(s.includes("label.localeCompare(b.label, 'tr')"));
assert.ok(s.includes('onlyPresent.checked'));
console.log('privacy final sort gate ok');
