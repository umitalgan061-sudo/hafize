import assert from 'node:assert/strict';
import { createGitHubReadFile, parseGitHubRepoAllowlist } from '../lib/github-read.mjs';

assert.deepEqual(
  parseGitHubRepoAllowlist('umitalgan061-sudo/hafize, example/demo,umitalgan061-sudo/hafize'),
  ['umitalgan061-sudo/hafize', 'example/demo']
);

const token = 'github_test_token_must_not_leak';
const calls = [];
const githubReadFile = createGitHubReadFile({
  token,
  allowedRepositories: ['umitalgan061-sudo/hafize'],
  fetchImpl: async (url, init) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('# Hafize\n').toString('base64'),
          sha: 'abc123',
          size: 9
        };
      }
    };
  }
});

const result = await githubReadFile({
  repository: 'umitalgan061-sudo/hafize',
  path: 'README.md',
  ref: 'main'
});

assert.equal(result.repository, 'umitalgan061-sudo/hafize');
assert.equal(result.path, 'README.md');
assert.equal(result.ref, 'main');
assert.equal(result.content, '# Hafize\n');
assert.equal(result.truncated, false);
assert.equal(calls.length, 1);
assert.match(calls[0].url, /\/repos\/umitalgan061-sudo\/hafize\/contents\/README\.md\?ref=main$/);
assert.equal(calls[0].init.headers.Authorization, `Bearer ${token}`);
assert.equal(JSON.stringify(result).includes(token), false);

await assert.rejects(
  () => githubReadFile({ repository: 'other/repo', path: 'README.md' }),
  (error) => error?.code === 'GITHUB_REPO_NOT_ALLOWED' && error?.status === 403
);
assert.equal(calls.length, 1, 'disallowed repo must be rejected before network access');

for (const sensitivePath of ['.env', 'config/client_secret.json', 'auth-token.txt', 'keys/private_key.pem']) {
  await assert.rejects(
    () => githubReadFile({ repository: 'umitalgan061-sudo/hafize', path: sensitivePath }),
    (error) => error?.code === 'SENSITIVE_GITHUB_PATH_BLOCKED' && error?.status === 403
  );
}
assert.equal(calls.length, 1, 'sensitive paths must be rejected before network access');

await assert.rejects(
  () => githubReadFile({ repository: 'umitalgan061-sudo/hafize', path: '../README.md' }),
  (error) => error?.code === 'INVALID_GITHUB_PATH'
);

await assert.rejects(
  () => githubReadFile({ repository: 'umitalgan061-sudo/hafize', path: 'README.md', extra: 'not-allowed' }),
  (error) => error?.code === 'INVALID_GITHUB_ARGUMENTS'
);
assert.equal(calls.length, 1, 'invalid arguments must be rejected before network access');

const unconfigured = createGitHubReadFile({
  token: '',
  allowedRepositories: ['umitalgan061-sudo/hafize'],
  fetchImpl: async () => {
    throw new Error('must not run');
  }
});
await assert.rejects(
  () => unconfigured({ repository: 'umitalgan061-sudo/hafize', path: 'README.md' }),
  (error) => error?.code === 'GITHUB_NOT_CONFIGURED' && error?.status === 503
);

console.log('GitHub read OK: allowlist, strict arguments, path guard and secret boundary enforced');
