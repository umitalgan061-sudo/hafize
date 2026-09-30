import { describe, expect, it } from 'vitest';
import {
  createGitHubWorkspaceWriter,
  GitHubWorkspaceWriteError
} from './github-workspace-write.ts';

const jsonResponse = (value: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return value; }
}) as Response;

function makeWriter(
  fetchImpl: typeof fetch,
  allowed = ['owner/repo']
) {
  return createGitHubWorkspaceWriter({
    token: 'github-test-token',
    allowedRepositories: allowed,
    fetchImpl
  });
}

describe('github workspace safe write core', () => {
  it('requires explicit approval before issuing a ticket', () => {
    const writer = makeWriter(async () => jsonResponse({}));
    expect(() => writer.issueApproval('branch', {
      repository: 'owner/repo',
      branch: 'feature/x',
      fromRef: 'main',
      approved: false
    })).toThrowError(new GitHubWorkspaceWriteError('GITHUB_WRITE_APPROVAL_REQUIRED', 428));
  });

  it('does not call upstream while creating an approval ticket', () => {
    let calls = 0;
    const writer = makeWriter(async () => {
      calls += 1;
      return jsonResponse({});
    });
    const ticket = writer.issueApproval('branch', {
      repository: 'owner/repo',
      branch: 'feature/x',
      fromRef: 'main',
      approved: true
    });
    expect(ticket.ticket).toMatch(/^[0-9a-f]{48}$/);
    expect(calls).toBe(0);
  });

  it('binds an approval ticket to the exact payload', () => {
    const writer = makeWriter(async () => jsonResponse({}));
    const ticket = writer.issueApproval('branch', {
      repository: 'owner/repo',
      branch: 'feature/x',
      fromRef: 'main',
      approved: true
    });
    expect(() => writer.createBranch(ticket.ticket, {
      repository: 'owner/repo',
      branch: 'feature/changed',
      fromRef: 'main'
    })).toThrowError(new GitHubWorkspaceWriteError('GITHUB_WRITE_APPROVAL_MISMATCH', 409));
  });

  it('consumes a ticket so it cannot be replayed', async () => {
    const calls: URL[] = [];
    const writer = makeWriter(async (url) => {
      calls.push(url);
      if (url.pathname.endsWith('/commits/main')) return jsonResponse({ sha: 'a'.repeat(40) });
      return jsonResponse({ ref: 'refs/heads/feature/x' });
    });
    const ticket = writer.issueApproval('branch', {
      repository: 'owner/repo',
      branch: 'feature/x',
      fromRef: 'main',
      approved: true
    });
    await expect(writer.createBranch(ticket.ticket, {
      repository: 'owner/repo',
      branch: 'feature/x',
      fromRef: 'main'
    })).resolves.toMatchObject({ branch: 'feature/x' });
    expect(calls).toHaveLength(2);
    await expect(writer.createBranch(ticket.ticket, {
      repository: 'owner/repo',
      branch: 'feature/x',
      fromRef: 'main'
    })).rejects.toMatchObject({
      code: 'GITHUB_WRITE_APPROVAL_EXPIRED',
      status: 409
    });
  });

  it('blocks repositories outside the write allowlist', () => {
    const writer = makeWriter(async () => jsonResponse({}), ['owner/allowed']);
    expect(() => writer.issueApproval('branch', {
      repository: 'owner/repo',
      branch: 'feature/x',
      fromRef: 'main',
      approved: true
    })).toThrowError(new GitHubWorkspaceWriteError('GITHUB_REPO_NOT_ALLOWED', 403));
  });

  it('accepts branch refs with slashes but rejects unsafe ref syntax', () => {
    const writer = makeWriter(async () => jsonResponse({}));
    expect(writer.normalizeInput('branch', {
      repository: 'owner/repo',
      branch: 'feature/github-write',
      fromRef: 'release/2026.09'
    })).toMatchObject({ branch: 'feature/github-write', fromRef: 'release/2026.09' });
    expect(() => writer.normalizeInput('branch', {
      repository: 'owner/repo',
      branch: 'feature/../escape',
      fromRef: 'main'
    })).toThrowError(GitHubWorkspaceWriteError);
    expect(() => writer.normalizeInput('branch', {
      repository: 'owner/repo',
      branch: 'feature@{bad}',
      fromRef: 'main'
    })).toThrowError(GitHubWorkspaceWriteError);
  });

  it('blocks sensitive and workflow paths', () => {
    const writer = makeWriter(async () => jsonResponse({}));
    const base = {
      repository: 'owner/repo',
      branch: 'feature/write',
      message: 'feat: add file',
      content: 'safe content'
    };
    expect(() => writer.normalizeInput('file', { ...base, path: '.env' }))
      .toThrowError(new GitHubWorkspaceWriteError('GITHUB_SENSITIVE_PATH_BLOCKED', 403));
    expect(() => writer.normalizeInput('file', { ...base, path: '.github/workflows/build.yml' }))
      .toThrowError(new GitHubWorkspaceWriteError('GITHUB_WORKFLOW_PATH_BLOCKED', 403));
    expect(() => writer.normalizeInput('file', { ...base, path: 'docs/private.key' }))
      .toThrowError(new GitHubWorkspaceWriteError('GITHUB_SENSITIVE_PATH_BLOCKED', 403));
  });

  it('blocks plaintext credentials in content and commit messages', () => {
    const writer = makeWriter(async () => jsonResponse({}));
    expect(() => writer.normalizeInput('file', {
      repository: 'owner/repo',
      branch: 'feature/write',
      path: 'src/config.ts',
      message: 'feat: add secret',
      content: 'API_KEY = "not-for-commit"'
    })).toThrowError(new GitHubWorkspaceWriteError('GITHUB_CONTENT_CREDENTIAL_BLOCKED', 403));
    expect(() => writer.normalizeInput('file', {
      repository: 'owner/repo',
      branch: 'feature/write',
      path: 'src/example.ts',
      message: 'Authorization: Bearer abcdefgh12345678',
      content: 'export const value = 1;'
    })).toThrowError(new GitHubWorkspaceWriteError('GITHUB_CONTENT_CREDENTIAL_BLOCKED', 403));
  });

  it('normalizes a new file and an explicit update SHA', () => {
    const writer = makeWriter(async () => jsonResponse({}));
    expect(writer.normalizeInput('file', {
      repository: 'owner/repo',
      branch: 'feature/write',
      path: 'src/example.ts',
      message: 'feat: add example',
      content: 'export const value = 1;'
    })).toMatchObject({ existingSha: '' });
    expect(writer.normalizeInput('file', {
      repository: 'owner/repo',
      branch: 'feature/write',
      path: 'src/example.ts',
      message: 'feat: update example',
      content: 'export const value = 2;',
      existingSha: 'a'.repeat(40)
    })).toMatchObject({ existingSha: 'a'.repeat(40) });
  });

  it('blocks direct commits to the repository default branch', async () => {
    const writer = makeWriter(async (url) => {
      if (url.pathname === '/repos/owner/repo') return jsonResponse({ default_branch: 'main' });
      return jsonResponse({});
    });
    const ticket = writer.issueApproval('file', {
      repository: 'owner/repo',
      branch: 'main',
      path: 'src/example.ts',
      message: 'feat: example',
      content: 'export const value = 1;',
      approved: true
    });
    await expect(writer.commitFile(ticket.ticket, {
      repository: 'owner/repo',
      branch: 'main',
      path: 'src/example.ts',
      message: 'feat: example',
      content: 'export const value = 1;'
    })).rejects.toMatchObject({
      code: 'GITHUB_DEFAULT_BRANCH_BLOCKED',
      status: 403
    });
  });

  it('creates a branch from a resolved ref SHA', async () => {
    const requests: Array<{ url: URL; init: RequestInit }> = [];
    const writer = makeWriter(async (url, init) => {
      requests.push({ url, init });
      if (url.pathname.endsWith('/commits/main')) return jsonResponse({ sha: 'b'.repeat(40) });
      return jsonResponse({ ref: 'refs/heads/feature/demo' });
    });
    const ticket = writer.issueApproval('branch', {
      repository: 'owner/repo',
      branch: 'feature/demo',
      fromRef: 'main',
      approved: true
    });
    const result = await writer.createBranch(ticket.ticket, {
      repository: 'owner/repo',
      branch: 'feature/demo',
      fromRef: 'main'
    });
    expect(result).toMatchObject({ branch: 'feature/demo', fromSha: 'b'.repeat(40) });
    expect(requests[0]?.init.method).toBe('GET');
    expect(requests[1]?.init.method).toBe('POST');
    expect(JSON.parse(String(requests[1]?.init.body))).toEqual({
      ref: 'refs/heads/feature/demo',
      sha: 'b'.repeat(40)
    });
  });

  it('creates a file commit through the contents API using base64', async () => {
    const requests: Array<{ url: URL; init: RequestInit }> = [];
    const writer = makeWriter(async (url, init) => {
      requests.push({ url, init });
      if (url.pathname === '/repos/owner/repo') return jsonResponse({ default_branch: 'main' });
      return jsonResponse({
        commit: {
          sha: 'c'.repeat(40),
          html_url: 'https://github.com/owner/repo/commit/' + 'c'.repeat(40)
        }
      });
    });
    const ticket = writer.issueApproval('file', {
      repository: 'owner/repo',
      branch: 'feature/write',
      path: 'src/example.ts',
      message: 'feat: add example',
      content: 'export const value = 1;',
      approved: true
    });
    const result = await writer.commitFile(ticket.ticket, {
      repository: 'owner/repo',
      branch: 'feature/write',
      path: 'src/example.ts',
      message: 'feat: add example',
      content: 'export const value = 1;'
    });
    expect(result).toMatchObject({ commitSha: 'c'.repeat(40), created: true });
    const body = JSON.parse(String(requests.at(-1)?.init.body));
    expect(body).toMatchObject({
      branch: 'feature/write',
      message: 'feat: add example'
    });
    expect(body.content).toBe(Buffer.from('export const value = 1;', 'utf8').toString('base64'));
  });

  it('uses optimistic existing SHA for file updates', async () => {
    const requests: RequestInit[] = [];
    const writer = makeWriter(async (_url, init) => {
      requests.push(init);
      if (_url.pathname === '/repos/owner/repo') return jsonResponse({ default_branch: 'main' });
      return jsonResponse({ commit: { sha: 'd'.repeat(40), html_url: 'https://github.com/owner/repo/commit/d' } });
    });
    const existingSha = 'e'.repeat(40);
    const ticket = writer.issueApproval('file', {
      repository: 'owner/repo',
      branch: 'feature/write',
      path: 'src/example.ts',
      message: 'fix: update example',
      content: 'export const value = 2;',
      existingSha,
      approved: true
    });
    const result = await writer.commitFile(ticket.ticket, {
      repository: 'owner/repo',
      branch: 'feature/write',
      path: 'src/example.ts',
      message: 'fix: update example',
      content: 'export const value = 2;',
      existingSha
    });
    expect(result).toMatchObject({ created: false });
    const body = JSON.parse(String(requests.at(-1)?.body));
    expect(body.sha).toBe(existingSha);
  });

  it('creates a pull request without exposing response details', async () => {
    const writer = makeWriter(async (_url, init) => {
      expect(init.method).toBe('POST');
      return jsonResponse({
        number: 42,
        title: 'feat: demo',
        html_url: 'https://github.com/owner/repo/pull/42',
        body: 'server response that should not be forwarded'
      });
    });
    const ticket = writer.issueApproval('pull', {
      repository: 'owner/repo',
      head: 'feature/write',
      base: 'main',
      title: 'feat: demo',
      body: 'Adds a safe example.',
      draft: true,
      approved: true
    });
    await expect(writer.createPullRequest(ticket.ticket, {
      repository: 'owner/repo',
      head: 'feature/write',
      base: 'main',
      title: 'feat: demo',
      body: 'Adds a safe example.',
      draft: true
    })).resolves.toEqual({
      action: 'pull',
      repository: 'owner/repo',
      number: 42,
      title: 'feat: demo',
      head: 'feature/write',
      base: 'main',
      draft: true,
      htmlUrl: 'https://github.com/owner/repo/pull/42'
    });
  });

  it('rejects a pull request from a branch to itself', () => {
    const writer = makeWriter(async () => jsonResponse({}));
    expect(() => writer.normalizeInput('pull', {
      repository: 'owner/repo',
      head: 'feature/write',
      base: 'feature/write',
      title: 'feat: same branch',
      body: '',
      draft: false
    })).toThrowError(GitHubWorkspaceWriteError);
  });

  it('reports an unconfigured writer without contacting GitHub', () => {
    const writer = createGitHubWorkspaceWriter({
      token: '',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async () => jsonResponse({})
    });
    expect(writer.configured()).toBe(false);
    expect(() => writer.issueApproval('branch', {
      repository: 'owner/repo',
      branch: 'feature/x',
      fromRef: 'main',
      approved: true
    })).toThrowError(new GitHubWorkspaceWriteError('GITHUB_NOT_CONFIGURED', 503));
  });

  it('returns bounded limits for client and server contracts', () => {
    const writer = makeWriter(async () => jsonResponse({}));
    expect(writer.limits).toMatchObject({
      maxRepository: 120,
      maxRef: 200,
      maxBranch: 200,
      maxPath: 400,
      maxContent: 96 * 1024,
      maxCommitMessage: 180,
      maxPrTitle: 240,
      maxPrBody: 4000,
      approvalTtlMs: 120000,
      maxApprovals: 1000
    });
  });
});
