import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/typed/workspace-backup.ts', root), 'utf8');
for (const marker of ['SHA-256',"subtle.digest('SHA-256'","backupWithoutIntegrity","candidate.integrity.digest","integrity === 'failed'","Bütünlük: doğrulandı","Bütünlük: başarısız"]) assert.ok(source.includes(marker), 'integrity marker missing: ' + marker);
console.log('workspace-backup-integrity: OK');
