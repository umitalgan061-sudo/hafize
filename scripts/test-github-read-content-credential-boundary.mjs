import assert from 'node:assert/strict';
import { createGitHubReadFile } from '../lib/github-read.mjs';

function responseFor(text) {
  const bytes = Buffer.from(text, 'utf8');
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        type: 'file',
        encoding: 'base64',
        content: bytes.toString('base64'),
        sha: 'fixture-sha',
        size: bytes.length
      };
    }
  };
}

let nextContent = '# Hafize\nGüvenli mimari notları.';
let fetchCalls = 0;
const readFile = createGitHubReadFile({
  token: 'connector-token-used-only-by-fetch-boundary',
  allowedRepositories: ['umitalgan061-sudo/hafize'],
  fetchImpl: async (_url, init) => {
    fetchCalls += 1;
    assert.match(init.headers.Authorization, /^Bearer /);
    return responseFor(nextContent);
  }
});

const safe = await readFile({
  repository: 'umitalgan061-sudo/hafize',
  path: 'README.md'
});
assert.equal(safe.content, nextContent);
assert.equal(safe.path, 'README.md');
assert.equal(safe.truncated, false);

const blockedContents = [
  'Kurulum: api_key = abcdef1234567890',
  'Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789',
  'Yanlışlıkla commit: nvapi-abcdefghijklmnopqrstuvwxyz123456',
  '-----BEGIN PRIVATE KEY-----\nsecret-material'
];

for (const content of blockedContents) {
  nextContent = content;
  await assert.rejects(
    () => readFile({ repository: 'umitalgan061-sudo/hafize', path: 'README.md' }),
    (error) => {
      assert.equal(error.code, 'GITHUB_CONTENT_CREDENTIAL_BLOCKED');
      assert.equal(error.status, 403);
      assert.doesNotMatch(error.message, /abcdef|nvapi|PRIVATE KEY/i,
        'public error must never echo blocked credential content');
      return true;
    }
  );
}

assert.equal(fetchCalls, 1 + blockedContents.length);
console.log('GitHub read content credential boundary tests passed');
