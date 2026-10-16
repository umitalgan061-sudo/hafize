
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/typed/settings-privacy.ts','utf8');
for (const required of ['navigator?.storage?.estimate?.()','usage: Number.isFinite','quota: Number.isFinite','storageEstimate(rootRef)']) assert.ok(source.includes(required),required);
console.log('privacy storage estimate contract ok');
