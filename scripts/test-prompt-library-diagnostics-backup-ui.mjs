import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-diagnostics.ts','utf8');
assert.match(source,/Yedek indir/);
assert.match(source,/exportRecoverySnapshot/);
assert.match(source,/hafize-prompt-library-recovery\.json/);
assert.match(source,/URL\.revokeObjectURL/);
console.log('prompt-library-diagnostics-backup-ui: ok');
