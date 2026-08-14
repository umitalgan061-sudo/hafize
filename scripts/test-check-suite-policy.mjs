import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  CHECK_OPT_IN_TESTS,
  CHECK_SOURCE_FILES,
  CHECK_SOURCE_ROOTS,
  CHECK_VALIDATORS,
  discoverCheckPlan,
  summarizeCheckPlan
} from './check-suite-policy.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'hafize-check-policy-'));

async function put(relative, content = 'export {};\n') {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

try {
  for (const dir of ['lib', 'public', 'desktop', 'scripts']) await mkdir(path.join(root, dir), { recursive: true });
  await put('server.mjs');
  await put('lib/zeta.mjs');
  await put('lib/alpha.js');
  await put('public/app.js');
  await put('desktop/main.mjs');
  await put('scripts/helper.mjs');
  await put('scripts/validate-agent-registry.mjs');
  await put('scripts/test-alpha.mjs');
  await put('scripts/test-beta.mjs');
  await put('scripts/test-redis-schedule-lease-live.mjs');
  await put('scripts/notes.txt', 'not JavaScript\n');

  const plan = await discoverCheckPlan({ rootDir: root });
  assert.deepEqual(plan.validators, ['scripts/validate-agent-registry.mjs']);
  assert.deepEqual(plan.tests, ['scripts/test-alpha.mjs', 'scripts/test-beta.mjs']);
  assert.equal(plan.syntaxFiles.includes('scripts/test-redis-schedule-lease-live.mjs'), true);
  assert.equal(plan.tests.includes('scripts/test-redis-schedule-lease-live.mjs'), false);
  assert.equal(plan.syntaxFiles.includes('scripts/notes.txt'), false);
  assert.deepEqual([...plan.syntaxFiles], [...plan.syntaxFiles].sort());
  assert.deepEqual(summarizeCheckPlan(plan), { syntaxFiles: 10, validators: 1, tests: 2, optInTests: 1 });
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.tests), true);

  await assert.rejects(
    discoverCheckPlan({ rootDir: root, optInTests: [{ path: 'scripts/test-missing-live.mjs', reason: 'external service' }] }),
    /CHECK_OPT_IN_TEST_MISSING/
  );
  await assert.rejects(
    discoverCheckPlan({ rootDir: root, validators: ['scripts/missing-validator.mjs'] }),
    /CHECK_VALIDATOR_MISSING/
  );
  await assert.rejects(
    discoverCheckPlan({ rootDir: root, sourceRoots: ['../escape'] }),
    /INVALID_CHECK_SOURCE_ROOT/
  );
  await assert.rejects(
    discoverCheckPlan({ rootDir: root, sourceRoots: ['missing'] }),
    /CHECK_SOURCE_ROOT_MISSING/
  );
  await assert.rejects(
    discoverCheckPlan({ rootDir: root, sourceFiles: ['missing.mjs'] }),
    /CHECK_SOURCE_FILE_MISSING/
  );
  await assert.rejects(
    discoverCheckPlan({
      rootDir: root,
      optInTests: [
        { path: 'scripts/test-redis-schedule-lease-live.mjs', reason: 'one' },
        { path: 'scripts/test-redis-schedule-lease-live.mjs', reason: 'two' }
      ]
    }),
    /DUPLICATE_CHECK_OPT_IN_TEST/
  );

  assert.deepEqual(CHECK_SOURCE_ROOTS, ['lib', 'public', 'desktop', 'scripts']);
  assert.deepEqual(CHECK_SOURCE_FILES, ['server.mjs']);
  assert.deepEqual(CHECK_VALIDATORS, ['scripts/validate-agent-registry.mjs']);
  assert.equal(CHECK_OPT_IN_TESTS.length, 1);
  assert.equal(CHECK_OPT_IN_TESTS[0].path, 'scripts/test-redis-schedule-lease-live.mjs');
  assert.match(CHECK_OPT_IN_TESTS[0].reason, /Redis/i);

  console.log('check suite policy tests passed');
} finally {
  await rm(root, { recursive: true, force: true });
}
