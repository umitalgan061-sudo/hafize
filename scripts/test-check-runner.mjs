import assert from 'node:assert/strict';
import { executeCheckPlan } from './run-checks.mjs';

const plan = Object.freeze({
  syntaxFiles: Object.freeze(['lib/a.mjs', 'scripts/test-a.mjs', 'scripts/test-opt-in.mjs']),
  validators: Object.freeze(['scripts/validate.mjs']),
  tests: Object.freeze(['scripts/test-a.mjs']),
  optInTests: Object.freeze([{ path: 'scripts/test-opt-in.mjs', reason: 'external service' }])
});

const calls = [];
const progress = [];
const summary = executeCheckPlan(plan, {
  rootDir: '/repo',
  run(args, options) {
    calls.push([args, options]);
    return { ok: true, status: 0, stdout: '', stderr: '' };
  },
  onProgress(label) { progress.push(label); },
  writeError() { throw new Error('unexpected error output'); }
});

assert.deepEqual(calls.map(([args]) => args), [
  ['--check', 'lib/a.mjs'],
  ['--check', 'scripts/test-a.mjs'],
  ['--check', 'scripts/test-opt-in.mjs'],
  ['scripts/validate.mjs'],
  ['scripts/test-a.mjs']
]);
assert.equal(calls.every(([, options]) => options.rootDir === '/repo'), true);
assert.equal(progress.at(-1), 'test scripts/test-a.mjs');
assert.deepEqual(summary, { syntaxFiles: 3, validators: 1, tests: 1, optInTests: 1 });

const syntaxCalls = [];
executeCheckPlan(plan, {
  syntaxOnly: true,
  run(args) { syntaxCalls.push(args); return { ok: true }; },
  onProgress() {},
  writeError() {}
});
assert.equal(syntaxCalls.length, 3);
assert.equal(syntaxCalls.some((args) => args[0] !== '--check'), false);

let errorText = '';
assert.throws(
  () => executeCheckPlan(plan, {
    run(args) {
      if (args[1] === 'scripts/test-a.mjs') return { ok: false, status: 1, stdout: 'fixture stdout\n', stderr: 'fixture stderr\n' };
      return { ok: true };
    },
    onProgress() {},
    writeError(value) { errorText += value; }
  }),
  /CHECK_STEP_FAILED:syntax scripts\/test-a\.mjs/
);
assert.match(errorText, /fixture stdout/);
assert.match(errorText, /fixture stderr/);

const testFailureCalls = [];
assert.throws(
  () => executeCheckPlan(plan, {
    run(args) {
      testFailureCalls.push(args);
      if (args[0] === 'scripts/test-a.mjs') return { ok: false, status: 2, stdout: '', stderr: '' };
      return { ok: true };
    },
    onProgress() {},
    writeError() {}
  }),
  /CHECK_STEP_FAILED:test scripts\/test-a\.mjs/
);
assert.equal(testFailureCalls.at(-1)[0], 'scripts/test-a.mjs');
assert.equal(testFailureCalls.some((args) => args[0] === 'scripts/test-opt-in.mjs'), false);

console.log('check runner tests passed');
