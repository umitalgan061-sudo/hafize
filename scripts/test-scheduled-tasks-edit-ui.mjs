import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/scheduled-tasks.js', import.meta.url), 'utf8');
for (const token of [
  "method: 'PATCH'",
  'data-task-action="edit"',
  'Düzenle',
  'Düzenlemeyi iptal et',
  'Değişiklikleri kaydet',
  'SCHEDULE_NOT_EDITABLE',
  'SCHEDULE_TASK_CREDENTIAL_NOT_ALLOWED',
  'encodeURIComponent(editingId)',
  'startEdit'
]) assert.ok(source.includes(token), `missing UI contract: ${token}`);
assert.ok(!source.includes('form.submit('));
console.log('scheduled task edit UI source contract ok');
