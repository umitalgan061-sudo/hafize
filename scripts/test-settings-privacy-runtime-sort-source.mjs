import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/settings-privacy.js','utf8');
assert.ok(s.includes("sort.value === 'size'"));
assert.ok(s.includes("a.label.localeCompare(b.label, 'tr')"));
assert.ok(s.includes('!onlyPresent.checked || item.present'));
console.log('privacy sort source ok');
