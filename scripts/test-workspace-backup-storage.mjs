import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/typed/workspace-backup.ts', root), 'utf8');
for (const marker of ['getItem','setItem','removeItem','safeStorage','hafize.workspace-backup.meta.v1']) assert.ok(source.includes(marker), 'storage marker missing: ' + marker);
assert.equal(source.includes('indexedDB'), false);
assert.equal(source.includes('localStorage.clear'), false);
assert.equal(source.includes('sendBeacon'), false);
console.log('workspace-backup-storage: OK');
