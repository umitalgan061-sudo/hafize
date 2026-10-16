import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-templates-backup.ts', import.meta.url), 'utf8');
assert.match(js, /hafize\.scheduled-task-templates\.v1/);
assert.match(js, /MAX_IMPORT = 200000/);
assert.match(js, /MAX_TEMPLATES = 12/);
assert.match(js, /Yedeği indir/);
assert.match(js, /Yedeği içe aktar/);
assert.match(js, /file\.text/);
assert.doesNotMatch(js, /fetch\(/);
console.log('scheduled-task-templates-backup: ok');
