import { describe, expect, it } from 'vitest';
import { createGitHubWorkspaceReader, GitHubWorkspaceError } from './github-workspace.ts';

const response = (value: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return value; }
}) as Response;

describe('github workspace reader', () => {
  it('reads a repository through the allowlist', async () => {
    const calls: URL[] = [];
    const reader = createGitHubWorkspaceReader({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async (url) => { calls.push(url); return response({
        name: 'repo',
        full_name: 'owner/repo',
        description: 'demo',
        default_branch: 'main',
        visibility: 'private',
        archived: false,
        html_url: 'https://github.com/owner/repo'
      }); }
    });
    await expect(reader.repository({ repository: 'owner/repo' })).resolves.toMatchObject({
      fullName: 'owner/repo',
      defaultBranch: 'main'
    });
    expect(calls[0]?.pathname).toBe('/repos/owner/repo');
  });

  it('blocks repositories outside the server allowlist', async () => {
    const reader = createGitHubWorkspaceReader({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async () => response({})
    });
    await expect(reader.repository({ repository: 'other/repo' })).rejects.toMatchObject({
      code: 'GITHUB_REPO_NOT_ALLOWED',
      status: 403
    });
  });

  it('normalizes branch data and bounds requests', async () => {
    let requested = '';
    const reader = createGitHubWorkspaceReader({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async (url) => {
        requested = url.search;
        return response([
          { name: 'main', protected: true, commit: { sha: 'a'.repeat(40) } },
          { name: 'dev', protected: false, commit: { sha: 'b'.repeat(40) } },
          { name: '', protected: false, commit: { sha: 'c'.repeat(40) } }
        ]);
      }
    });
    const result = await reader.branches({ repository: 'owner/repo', limit: 999 });
    expect(requested).toContain('per_page=30');
    expect(result.branches).toHaveLength(2);
    expect(result.branches[0]).toMatchObject({ name: 'main', protected: true });
  });

  it('passes a safe ref to the commits endpoint', async () => {
    let requested = '';
    const reader = createGitHubWorkspaceReader({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async (url) => { requested = url.search; return response([]); }
    });
    await reader.commits({ repository: 'owner/repo', ref: 'feature/demo', limit: 5 });
    expect(requested).toContain('sha=feature%2Fdemo');
    expect(requested).toContain('per_page=5');
  });

  it('restricts pull request state to known values', async () => {
    let requested = '';
    const reader = createGitHubWorkspaceReader({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async (url) => { requested = url.search; return response([]); }
    });
    const result = await reader.pulls({ repository: 'owner/repo', state: 'unknown', limit: 3 });
    expect(result.state).toBe('open');
    expect(requested).toContain('state=open');
  });

  it('delegates file reads to the credential-aware GitHub reader', async () => {
    const inputs: unknown[] = [];
    const reader = createGitHubWorkspaceReader({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      readFile: async (input) => {
        inputs.push(input);
        return { path: 'src/a.ts', ref: 'main', sha: 'abc', size: 12, truncated: false, content: 'export {}' };
      }
    });
    await expect(reader.file({ repository: 'owner/repo', path: 'src/a.ts', ref: 'main' })).resolves.toMatchObject({
      path: 'src/a.ts',
      content: 'export {}'
    });
    expect(inputs[0]).toEqual({ repository: 'owner/repo', path: 'src/a.ts', ref: 'main' });
  });

  it('rejects traversal and malformed repository input before fetch', async () => {
    const reader = createGitHubWorkspaceReader({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async () => response({})
    });
    await expect(reader.file({ repository: 'owner/repo', path: '../secret' })).rejects.toMatchObject({
      code: 'INVALID_GITHUB_PATH'
    });
    await expect(reader.repository({ repository: 'bad value' })).rejects.toBeInstanceOf(GitHubWorkspaceError);
  });

  it('maps upstream failures without exposing response body', async () => {
    const reader = createGitHubWorkspaceReader({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async () => response({ message: 'token should not be surfaced' }, 500)
    });
    await expect(reader.repository({ repository: 'owner/repo' })).rejects.toMatchObject({
      code: 'GITHUB_ENDPOINT_FAILED',
      status: 500
    });
  });
});
