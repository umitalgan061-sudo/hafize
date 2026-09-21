import { describe, expect, it } from 'vitest';
import { createGitHubWorkspaceExtra, GitHubWorkspaceExtraError } from './github-workspace-extra.ts';

const response = (value: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return value; }
}) as Response;

describe('github workspace extra reader', () => {
  it('lists safe directory entries and filters secret-like names', async () => {
    const reader = createGitHubWorkspaceExtra({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async () => response([
        { name: 'src', path: 'src', type: 'dir', size: 0, sha: 'a' },
        { name: 'README.md', path: 'README.md', type: 'file', size: 10, sha: 'b' },
        { name: '.env', path: '.env', type: 'file', size: 10, sha: 'c' },
        { name: 'private-key.pem', path: 'private-key.pem', type: 'file', size: 10, sha: 'd' }
      ])
    });
    const result = await reader.directory({ repository: 'owner/repo', path: '', ref: 'main' });
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((entry) => entry.name)).toEqual(['src', 'README.md']);
  });

  it('rejects directory traversal', async () => {
    const reader = createGitHubWorkspaceExtra({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async () => response([])
    });
    await expect(reader.directory({ repository: 'owner/repo', path: 'src/../secret' })).rejects.toMatchObject({
      code: 'INVALID_GITHUB_PATH'
    });
  });

  it('compares two different refs through GitHub compare API', async () => {
    let endpoint = '';
    const reader = createGitHubWorkspaceExtra({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async (url) => {
        endpoint = url.pathname;
        return response({
          status: 'ahead',
          ahead_by: 2,
          behind_by: 0,
          total_commits: 2,
          files: [
            { filename: 'src/a.ts', status: 'modified', additions: 4, deletions: 1, changes: 5 }
          ]
        });
      }
    });
    await expect(reader.compare({ repository: 'owner/repo', base: 'main', head: 'feature/x' })).resolves.toMatchObject({
      status: 'ahead',
      aheadBy: 2,
      totalCommits: 2
    });
    expect(endpoint).toContain('/compare/main...feature%2Fx');
  });

  it('does not compare a ref to itself', async () => {
    const reader = createGitHubWorkspaceExtra({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async () => response({})
    });
    await expect(reader.compare({ repository: 'owner/repo', base: 'main', head: 'main' })).rejects.toMatchObject({
      code: 'INVALID_GITHUB_ARGUMENTS'
    });
  });

  it('bounds the comparison file list', async () => {
    const files = Array.from({ length: 60 }, (_, index) => ({
      filename: 'file-' + index + '.ts',
      status: 'modified',
      additions: 1,
      deletions: 0,
      changes: 1
    }));
    const reader = createGitHubWorkspaceExtra({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async () => response({ status: 'identical', files })
    });
    const result = await reader.compare({ repository: 'owner/repo', base: 'main', head: 'other' });
    expect(result.files).toHaveLength(30);
  });

  it('maps upstream failures to a stable error code', async () => {
    const reader = createGitHubWorkspaceExtra({
      token: 'test-token',
      allowedRepositories: ['owner/repo'],
      fetchImpl: async () => response({}, 403)
    });
    await expect(reader.directory({ repository: 'owner/repo' })).rejects.toBeInstanceOf(GitHubWorkspaceExtraError);
    await expect(reader.directory({ repository: 'owner/repo' })).rejects.toMatchObject({ code: 'GITHUB_ENDPOINT_FAILED', status: 403 });
  });
});
