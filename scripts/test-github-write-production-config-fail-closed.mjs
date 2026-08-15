import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function reservePort() {
  const probe = createNetServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address()?.port || 0;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}
async function runStartup(env) {
  const child = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exitCode = await Promise.race([new Promise((resolve) => child.once('exit', (code) => resolve(code))), delay(3_000).then(() => null)]);
  if (exitCode == null) child.kill('SIGKILL');
  return { exitCode, stdout, stderr };
}

const approvalSecret = Buffer.alloc(32, 81).toString('base64url');
const ownerKey = Buffer.alloc(32, 82).toString('base64url');
const base = {
  ...process.env,
  HOST: '127.0.0.1',
  NVIDIA_API_KEY: '',
  HAFIZE_GITHUB_WRITE_ENABLED: 'true',
  GITHUB_TOKEN: 'config-test-github-token',
  HAFIZE_GITHUB_WRITE_REPOS: 'umitalgan061-sudo/hafize',
  HAFIZE_GITHUB_WRITE_APPROVAL_SECRET: approvalSecret,
  HAFIZE_GITHUB_WRITE_AUTH_TOKEN: 'config-test-owner-token',
  HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: 'config-test-owner',
  HAFIZE_GITHUB_WRITE_OWNER_KEY: ownerKey,
  HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL: 'redis://shared-replay:6379/0',
  HAFIZE_SCHEDULE_STORAGE_FILE: '',
  HAFIZE_SCHEDULE_STORAGE_KEY_BASE64: '',
  HAFIZE_SCHEDULE_LEASE_PROVIDER: '',
  HAFIZE_SCHEDULE_REDIS_URL: ''
};
const secrets = [approvalSecret, ownerKey, base.GITHUB_TOKEN, base.HAFIZE_GITHUB_WRITE_AUTH_TOKEN];
const required = [
  'GITHUB_TOKEN',
  'HAFIZE_GITHUB_WRITE_REPOS',
  'HAFIZE_GITHUB_WRITE_APPROVAL_SECRET',
  'HAFIZE_GITHUB_WRITE_AUTH_TOKEN',
  'HAFIZE_GITHUB_WRITE_AUTH_SUBJECT',
  'HAFIZE_GITHUB_WRITE_OWNER_KEY',
  'HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL'
];
for (const missing of required) {
  const port = await reservePort();
  const env = { ...base, PORT: String(port), [missing]: '' };
  const result = await runStartup(env);
  assert.notEqual(result.exitCode, null, `${missing} omission must not leave server running`);
  assert.notEqual(result.exitCode, 0, `${missing} omission must fail closed`);
  assert.match(result.stderr, /INVALID_GITHUB_WRITE_(?:NODE_)?SERVER_RUNTIME:configuration/);
  assert.equal(result.stdout.includes('Hafize listening on'), false);
  for (const secret of secrets) {
    assert.equal(result.stdout.includes(secret), false);
    assert.equal(result.stderr.includes(secret), false);
  }
}
console.log('GitHub write production configuration fail-closed tests passed');
