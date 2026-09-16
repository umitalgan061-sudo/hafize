import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const ui=await readFile(new URL('../public/scheduled-tasks.js',import.meta.url),'utf8');
for(const token of ['startEdit','postponeTask','duplicateTask','bulkPostpone','bulkCancel','Düzenlemeyi iptal et','Tekrar planla']) assert.ok(ui.includes(token),`missing flow ${token}`);
console.log('scheduled task edit user flow contracts ok');
