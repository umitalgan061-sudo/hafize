import { describe, expect, it } from 'vitest';
import { createGitHubReadFile, GitHubReadError, parseGitHubRepoAllowlist } from './github-read.ts';

function response(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; }
  } as Response;
}

describe('typed GitHub read boundary', () => {
  it('normalizes allowlists', () => {
    expect(parseGitHubRepoAllowlist('umitalgan/a, umitalgan/a, x/y')).toEqual(['umitalgan/a', 'x/y']);
    expect(parseGitHubRepoAllowlist(['a/b', 'a/b'])).toEqual(['a/b']);
  });

  it('enforces repository allowlisting and path safety', async () => {
    const read = createGitHubReadFile({ token: 'secret', allowedRepositories: ['a/b'], fetchImpl: async () => response({
      type: 'file', encoding: 'base64', content: Buffer.from('hello').toString('base64'), sha: 'abc', size: 5
    }) });
    await expect(read({ repository: 'x/y', path: 'README.md' })).rejects.toMatchObject({ code: 'GITHUB_REPO_NOT_ALLOWED', status: 403 });
    await expect(read({ repository: 'a/b', path: '../secret.txt' })).rejects.toMatchObject({ code: 'INVALID_GITHUB_PATH' });
    await expect(read({ repository: 'a/b', path: '.env' })).rejects.toMatchObject({ code: 'SENSITIVE_GITHUB_PATH_BLOCKED', status: 403 });
  });

  it('decodes bounded text content', async () => {
    const read = createGitHubReadFile({
      token: 'token',
      allowedRepositories: ['a/b'],
      maxFileBytes: 5,
      fetchImpl: async () => response({
        type: 'file', encoding: 'base64',
        content: Buffer.from('hello world').toString('base64'),
        sha: 'abc', size: 11
      })
    });
    await expect(read({ repository: 'a/b', path: 'README.md' })).resolves.toMatchObject({
      repository: 'a/b',
      path: 'README.md',
      content: 'hello',
      truncated: true
    });
  });

  it('blocks credential-bearing file content', async () => {
    const read = createGitHubReadFile({
      token: 'token',
      allowedRepositories: ['a/b'],
      fetchImpl: async () => response({
        type: 'file', encoding: 'base64',
        content: Buffer.from('API_KEY=super-secret-value').toString('base64')
      })
    });
    await expect(read({ repository: 'a/b', path: 'README.md' })).rejects.toMatchObject({
      code: 'GITHUB_CONTENT_CREDENTIAL_BLOCKED', status: 403
    });
  });

  it('maps upstream HTTP and invalid payload failures to safe errors', async () => {
    const unavailable = createGitHubReadFile({ token: 'token', allowedRepositories: ['a/b'], fetchImpl: async () => response({}, 500) });
    await expect(unavailable({ repository: 'a/b', path: 'README.md' })).rejects.toMatchObject({ code: 'GITHUB_READ_FAILED', status: 500 });
    const invalid = createGitHubReadFile({ token: 'token', allowedRepositories: ['a/b'], fetchImpl: async () => response({ type: 'blob' }) });
    await expect(invalid({ repository: 'a/b', path: 'README.md' })).rejects.toBeInstanceOf(GitHubReadError);
  });
});
