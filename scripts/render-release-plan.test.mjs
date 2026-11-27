import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentActivityVerdict, hookForCommit, isRuntimePath, planRelease, qualityVerdict, RENDER_SERVICE, validateDeployHook } from './render-release-plan.mjs';

const HEAD = 'a'.repeat(40);
const LIVE = 'b'.repeat(40);
const HOOK = `https://api.render.com/deploy/${RENDER_SERVICE}?key=fixture-only`;

test('only this service hook with only a key parameter is accepted', () => {
  assert.equal(validateDeployHook(HOOK).ok, true);
  for (const bad of ['', 'not a url', 'http://api.render.com/deploy/' + RENDER_SERVICE + '?key=x',
    'https://api.render.com/deploy/srv-other?key=x', 'https://evil.example/deploy/' + RENDER_SERVICE + '?key=x',
    `https://api.render.com/deploy/${RENDER_SERVICE}`, `https://api.render.com/deploy/${RENDER_SERVICE}?key=`,
    `https://api.render.com/deploy/${RENDER_SERVICE}?key=x&ref=${HEAD}`, `https://api.render.com/deploy/${RENDER_SERVICE}?key=x&key=y`,
    `https://u:p@api.render.com/deploy/${RENDER_SERVICE}?key=x`, `https://api.render.com/deploy/${RENDER_SERVICE}?key=x#frag`]) {
    assert.equal(validateDeployHook(bad).ok, false, bad);
  }
});

test('the deploy URL pins the exact commit', () => {
  const url = new URL(hookForCommit(HOOK, HEAD));
  assert.equal(url.searchParams.get('ref'), HEAD);
  assert.equal(url.searchParams.get('key'), 'fixture-only');
  assert.throws(() => hookForCommit(HOOK, 'main'), /RELEASE_SHA_INVALID/);
  assert.throws(() => hookForCommit('https://evil.example/x?key=1', HEAD), /RENDER_DEPLOY_HOOK_INVALID/);
});

test('docs, workflows and tests do not trigger a deploy; runtime files do', () => {
  for (const path of ['docs/x.md', 'README.md', '.github/workflows/q.yml', 'lib/a.test.ts', 'public/typed/b.test.ts',
    'scripts/test-foo.mjs', 'scripts/validate-bar.mjs', 'tests/fixture.json']) assert.equal(isRuntimePath(path), false, path);
  for (const path of ['server.ts', 'lib/project-vision-judge.ts', 'public/sw-policy.ts', 'package.json', 'package-lock.json',
    'Dockerfile', 'render.yaml', 'scripts/render-release.mjs']) assert.equal(isRuntimePath(path), true, path);
});

test('quality verdict uses the latest push run of the quality workflow for that commit', () => {
  const run = (extra) => ({ name: 'Hafize quality', head_sha: HEAD, event: 'push', status: 'completed', conclusion: 'success', run_attempt: 1, created_at: '2026-11-26T10:00:00Z', ...extra });
  assert.equal(qualityVerdict([], HEAD), 'missing');
  assert.equal(qualityVerdict([run({ head_sha: LIVE })], HEAD), 'missing');
  assert.equal(qualityVerdict([run({ event: 'pull_request' })], HEAD), 'missing');
  assert.equal(qualityVerdict([run({ name: 'Other' }), run({})], HEAD), 'success');
  assert.equal(qualityVerdict([run({ status: 'in_progress', conclusion: null })], HEAD), 'pending');
  assert.equal(qualityVerdict([run({ conclusion: 'failure' })], HEAD), 'failure');
  assert.equal(qualityVerdict([run({ conclusion: 'failure', run_attempt: 1 }), run({ run_attempt: 2 })], HEAD), 'success');
});

test('release plan: newest green main, only when something the service runs changed', () => {
  const base = { head: HEAD, live: LIVE, quality: 'success', changedPaths: ['server.ts'] };
  assert.deepEqual(planRelease(base), { action: 'deploy', reason: 'RUNTIME_CHANGED', runtimeFiles: 1 });
  assert.equal(planRelease({ ...base, live: HEAD }).reason, 'ALREADY_LIVE');
  assert.equal(planRelease({ ...base, quality: 'failure' }).reason, 'QUALITY_FAILURE');
  assert.equal(planRelease({ ...base, quality: 'pending' }).action, 'skip');
  assert.equal(planRelease({ ...base, quality: 'pending', force: true }).action, 'skip');
  assert.equal(planRelease({ ...base, changedPaths: ['docs/a.md', 'lib/x.test.ts'] }).reason, 'NO_RUNTIME_CHANGE');
  assert.equal(planRelease({ ...base, changedPaths: ['docs/a.md'], force: true }).reason, 'FORCED');
  assert.equal(planRelease({ ...base, live: null, changedPaths: [] }).reason, 'LIVE_UNKNOWN');
  assert.equal(planRelease({ ...base, liveKnown: false, changedPaths: [] }).reason, 'LIVE_UNKNOWN');
  assert.equal(planRelease({ ...base, head: 'main' }).action, 'error');
});

test('the release command does nothing without the secret and never prints an invalid hook', async () => {
  const { spawnSync } = await import('node:child_process');
  const script = new URL('./render-release.mjs', import.meta.url).pathname;
  const run = (hook) => spawnSync(process.execPath, [script], {
    encoding: 'utf8', timeout: 20000,
    env: { PATH: process.env.PATH, HAFIZE_RENDER_DEPLOY_HOOK: hook, GH_TOKEN: '', GITHUB_STEP_SUMMARY: '' }
  });
  const missing = run('');
  assert.equal(missing.status, 0);
  assert.match(missing.stdout, /HAFIZE_RENDER_DEPLOY_HOOK tanımlı değil/);
  const secret = 'https://evil.example/deploy/x?key=super-secret-value';
  const invalid = run(secret);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /RENDER_DEPLOY_HOOK_INVALID/);
  assert.doesNotMatch(invalid.stdout + invalid.stderr, /super-secret-value|evil\.example/);
});

test('scheduled deploy skips active, pending, stale and malformed health even when CI is green',()=>{
 const idle={status:'ok',revision:LIVE,durableGitHubTaskActive:false,durableGitHubDeploymentPending:false};
 assert.equal(deploymentActivityVerdict(idle,LIVE),'IDLE');
 assert.equal(deploymentActivityVerdict({...idle,durableGitHubTaskActive:true},LIVE),'ACTIVE_AGENT_TASK');
 assert.equal(deploymentActivityVerdict({...idle,durableGitHubDeploymentPending:true},LIVE),'DEPLOYMENT_PENDING');
 for(const health of [null,{}, {...idle,revision:HEAD},{...idle,status:'error'},{...idle,durableGitHubTaskActive:'false'},{...idle,durableGitHubDeploymentPending:undefined}])assert.equal(deploymentActivityVerdict(health,LIVE),'HEALTH_UNVERIFIED');
 assert.equal(deploymentActivityVerdict(idle,null),'HEALTH_UNVERIFIED');
});
