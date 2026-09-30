import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertBoundDeclared, assertDataAttributeDeclared } from './source-contract.mjs';

const js = await readFile(new URL('../public/scheduled-task-duplicate.js', import.meta.url), 'utf8');

for (const state of ['scheduled', 'completed', 'failed', 'cancelled']) assert.match(js, new RegExp(state));
// The row's state is checked against an allowlist rather than one inequality,
// and the row's fields are read through `dataset`, which is the same attribute.
assert.match(js, /\['scheduled', 'completed', 'failed', 'cancelled'\]\.includes\(row\.dataset\.status\)/);
for (const attribute of ['data-agent-id', 'data-max-attempts', 'data-run-at']) {
  assertDataAttributeDeclared(js, attribute);
}
console.log('scheduled-task-duplicate-states: ok');
