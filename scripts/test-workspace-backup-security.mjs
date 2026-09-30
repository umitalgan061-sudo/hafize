import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/typed/workspace-backup.ts', root), 'utf8');
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'Authorization', 'Bearer ']) assert.equal(source.includes(forbidden), false, 'forbidden boundary: ' + forbidden);
for (const marker of ['surfaceContainsSensitiveKey','allowedStorageKey','token','secret','credential','password','oauth','session','auth.']) assert.ok(source.toLocaleLowerCase('en-US').includes(marker.toLocaleLowerCase('en-US')), 'security marker missing: ' + marker);
assert.equal(source.includes('.github/workflows'), false);
assert.equal(source.includes('navigator.sendBeacon'), false);
console.log('workspace-backup-security: OK');
