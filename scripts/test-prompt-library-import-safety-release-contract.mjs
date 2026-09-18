import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile('public/prompt-library-safety.js', 'utf8');

const required = [
  'buildImportPlan',
  'applyImportPlan',
  'normalizeRecoveryPayload',
  'buildRepairPreview',
  'quarantineInvalidItems',
  'restoreQuarantine',
  'createRepairCheckpoint',
  'undoLastRepair',
  'exportRecoverySnapshot'
];

for (const name of required) {
  assert.ok(source.includes(name), name + ' missing');
}

const importLimit = source.indexOf('MAX_IMPORT_BYTES');
const itemLimit = source.indexOf('MAX_ITEMS');
const recovery = source.indexOf('exportRecoverySnapshot');
assert.ok(importLimit >= 0 && itemLimit > importLimit && recovery > itemLimit);

console.log('prompt-library-import-safety-release-contract: ok');
