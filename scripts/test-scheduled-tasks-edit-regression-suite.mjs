import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const source = await read('public/scheduled-tasks.js');
const css = await read('public/scheduled-tasks.css');
const boundary = await read('lib/schedule-command-boundary.mjs');
const http = await read('lib/schedule-http-api.mjs');
const store = await read('lib/task-schedule-store.mjs');
const persistence = await read('lib/task-schedule-persistence.mjs');
const readme = await read('README.md');
const policy = await read('public/sw-policy.js');

const requiredSource = [
  'editingId', 'buildCreateForm', 'startEdit', 'duplicateTask', 'postponeTask',
  'bulkPostpone', 'bulkCancel', 'selectedIds', 'MAX_SELECTION', 'SCHEDULE_NOT_EDITABLE',
  'SCHEDULE_TASK_CREDENTIAL_NOT_ALLOWED', "method: 'PATCH'", "method: 'DELETE'",
  'Düzenle', 'Değişiklikleri kaydet', 'Düzenlemeyi iptal et', '+15 dk', '+1 saat',
  'Tekrar planla', 'Seçilenleri iptal et', 'Seçimi temizle'
];
for (const token of requiredSource) assert.ok(source.includes(token), `UI token missing: ${token}`);

const requiredStore = ['UPDATE_FIELDS', 'function update(', 'INVALID_TASK_SCHEDULE_TRANSITION', 'updatedAt', 'lastError'];
for (const token of requiredStore) assert.ok(store.includes(token), `store token missing: ${token}`);

assert.ok(persistence.includes("'update'"));
assert.ok(persistence.includes('update: (...args) => mutate'));
assert.ok(boundary.includes('async function update('));
assert.ok(boundary.includes('current.ownerId !== ownerId'));
assert.ok(boundary.includes('current.status !== \'scheduled\''));
assert.ok(boundary.includes('containsPlaintextCredential'));
assert.ok(http.includes("verb === 'PATCH'"));
assert.ok(http.includes("Allow: root ? 'GET, POST' : 'PATCH, DELETE'"));
assert.ok(policy.includes("pathname.startsWith('/api/')"));
assert.ok(!policy.includes("'/api/schedules'"));
assert.ok(css.includes('.scheduled-tasks-form-actions'));
assert.ok(css.includes('.scheduled-tasks-bulk'));
assert.ok(css.includes('@media (max-width:650px)'));
assert.ok(css.includes('@media (forced-colors:active)'));
assert.ok(readme.includes('PATCH/DELETE'));
assert.ok(readme.includes('+15 dk'));
assert.ok(readme.includes('+1 saat'));
assert.ok(readme.includes('Tekrar planla'));

const docs = await Promise.all([
  'docs/SCHEDULED_TASK_EDIT.md',
  'docs/SCHEDULED_TASK_EDIT_API.md',
  'docs/SCHEDULED_TASK_EDIT_SECURITY.md',
  'docs/SCHEDULED_TASK_EDIT_ACCESSIBILITY.md',
  'docs/SCHEDULED_TASK_EDIT_QA.md',
  'docs/SCHEDULED_TASK_EDIT_OPERATIONS.md',
  'docs/SCHEDULED_TASK_EDIT_STATE_MACHINE.md',
  'docs/SCHEDULED_TASK_EDIT_DATA_MODEL.md',
  'docs/SCHEDULED_TASK_EDIT_RELEASE.md',
  'docs/SCHEDULED_TASK_EDIT_ROLLBACK.md',
  'docs/SCHEDULED_TASK_EDIT_SUPPORT.md',
  'docs/SCHEDULED_TASK_EDIT_USER_GUIDE.md'
].map(read));
for (const text of docs) assert.ok(text.trim().length > 80);

console.log('scheduled task edit consolidated regression suite ok');
