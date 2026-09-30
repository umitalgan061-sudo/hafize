import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/typed/workspace-backup.ts', root), 'utf8');
for (const marker of ['captureRaw','restoreRaw','rolledBack: true','rootRef.confirm','Seçilenleri geri yükle','Tümünü seç','Seçimleri temizle','Geri yükleme önizlemesi']) assert.ok(source.includes(marker), 'restore marker missing: ' + marker);
console.log('workspace-backup-restore: OK');
