import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-import-preview.js','utf8');
const open=source.indexOf('function open(file)');
const apply=source.indexOf('applyImportPlan(activePlan');
assert.ok(open>=0 && apply>open);
const create=source.indexOf('createDialog()');
assert.ok(create>=0 && create<apply);
console.log('prompt-library-import-recovery-no-write: ok');
