import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/typed/workspace-backup.ts', root), 'utf8');
for (const marker of ['MAX_BACKUP_BYTES = 2_000_000','MAX_SECTION_BYTES = 1_200_000','MAX_SECTIONS = 32','MAX_SMART_FILL_ENTRIES = 24','MAX_KEY_LENGTH = 180']) assert.ok(source.includes(marker), 'limit missing: ' + marker);
for (const marker of ['file.size > MAX_BACKUP_BYTES','slice(0, MAX_SECTIONS)','slice(0, MAX_SMART_FILL_ENTRIES)']) assert.ok(source.includes(marker), 'bound missing: ' + marker);
console.log('workspace-backup-limits: OK');
