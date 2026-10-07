
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/typed/settings-privacy.ts','utf8');
for (const required of ['documentRef.createElement','textContent','replaceChildren','row.dataset.privacySurface','wipe.dataset.privacyClear']) assert.ok(source.includes(required),required);
assert.ok(!source.includes('innerHTML ='));
assert.ok(!source.includes('outerHTML'));
console.log('privacy DOM safety contract ok');
