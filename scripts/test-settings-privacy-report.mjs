
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/typed/settings-privacy.ts','utf8');
for (const required of ['format: \'hafize-privacy-report\'','version: 1','generatedAt','knownBytes','unknownBytes','storageUsage','MAX_REPORT_BYTES','payload.surfaces = payload.surfaces.slice']) assert.ok(source.includes(required),required);
assert.ok(!source.includes('content: raw'));
console.log('privacy report contract ok');
