import assert from 'node:assert/strict';
import { createGitHubWriteClient } from '../lib/github-write-client.mjs';

const repository = 'umitalgan061-sudo/hafize';
const token = 'github_test_token_abcdefghijklmnopqrstuvwxyz';
const calls = [];
const responses = [
  { object: { sha: 'a'.repeat(40) } }, { object: { sha: 'b'.repeat(40) } },
  { commit: { sha: 'c'.repeat(40) }, content: { sha: 'd'.repeat(40) } }, { number: 130 },
  { merged: true, sha: 'e'.repeat(40) }
];
const client = createGitHubWriteClient({
  token, allowedRepositories: new Set([repository]), baseUrl: 'https://api.github.test/',
  fetchImpl: async (url, options) => {
    calls.push([url, options]);
    const payload = responses.shift();
    return { ok: true, status: 200, async json() { return payload; } };
  }
});
const branch = { operation: 'branch.create', repository, branch: 'hafize/client-test', baseRef: 'main' };
assert.deepEqual(await client.createBranch(branch), { sha: 'b'.repeat(40) });
assert.equal(calls[0][1].headers.Authorization, `Bearer ${token}`);
assert.deepEqual(JSON.parse(calls[1][1].body), { ref: 'refs/heads/hafize/client-test', sha: 'a'.repeat(40) });

const file = {
  operation: 'file.update', repository, branch: branch.branch, path: 'lib/a b.mjs', expectedBlobSha: 'f'.repeat(40),
  commitMessage: 'fix: exact REST update', content: 'export const rest = true;\n'
};
assert.deepEqual(await client.updateFile(file), { commitSha: 'c'.repeat(40), blobSha: 'd'.repeat(40) });
assert.match(calls[2][0], /contents\/lib\/a%20b\.mjs$/);
const fileBody = JSON.parse(calls[2][1].body);
assert.equal(Buffer.from(fileBody.content, 'base64').toString(), file.content);
assert.equal(fileBody.sha, file.expectedBlobSha);

const pr = { operation: 'pr.create', repository, head: branch.branch, base: 'main', title: 'feat: REST', draft: true };
assert.deepEqual(await client.createPullRequest(pr), { prNumber: 130 });
const merge = { operation: 'pr.merge', repository, prNumber: 130, expectedHeadSha: '1'.repeat(40) };
assert.deepEqual(await client.mergePullRequest(merge), { merged: true, sha: 'e'.repeat(40) });
assert.deepEqual(JSON.parse(calls[4][1].body), { sha: merge.expectedHeadSha });

await assert.rejects(() => client.updateFile({ ...file, branch: 'main' }), /GITHUB_WRITE_BRANCH_NOT_ALLOWED/);
assert.equal(calls.length, 5, 'invalid direct input must fail before network');
const failing = createGitHubWriteClient({
  token, allowedRepositories: new Set([repository]),
  fetchImpl: async () => ({ ok: false, status: 403, async json() { return { message: 'secret path /Users/private' }; } })
});
await assert.rejects(() => failing.createPullRequest(pr), (error) => error.code === 'GITHUB_WRITE_PROVIDER_FAILED' && error.status === 403 && !error.message.includes('/Users/'));
assert.throws(() => createGitHubWriteClient({ token: '', allowedRepositories: new Set([repository]) }), /INVALID_GITHUB_WRITE_TOKEN/);
console.log('github write client tests passed');
