import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/typed/workspace-backup.ts', root), 'utf8');
for (const marker of ['validStaticSection','validSmartFillSection','selectedSections','Geçersiz veya izin verilmeyen yüzey','Yedek bütünlük doğrulamasından geçmedi']) assert.ok(source.includes(marker), 'format marker missing: ' + marker);
console.log('workspace-backup-format: OK');
