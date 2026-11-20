import { describe, expect, it } from 'vitest';
import { createGitHubAppCiReader } from './github-app-ci.ts';

const json = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body; }
}) as Response;

describe('GitHub App CI reader', () => {
  it('rejects unauthorized repositories before requesting a token', async () => {
    let calls = 0;
    const reader = createGitHubAppCiReader({
      allowedRepositories: ['owner/repo'],
      getToken: async () => { calls++; return 'secret'; },
      fetchImpl: async () => json({})
    });
    await expect(reader.runs({ repository: 'evil/repo' })).rejects.toMatchObject({
      code: 'GITHUB_CI_REPO_NOT_ALLOWED',
      status: 403
    });
    expect(calls).toBe(0);
  });

  it('uses only actions read tokens and returns bounded safe run metadata', async () => {
    const scopeCalls: string[] = [];
    const urls: string[] = [];
    const reader = createGitHubAppCiReader({
      allowedRepositories: ['owner/repo'],
      getToken: async (_repo, scope) => { scopeCalls.push(scope); return 'actions-token'; },
      fetchImpl: async (url, init) => {
        urls.push(String(url));
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer actions-token');
        return json({ workflow_runs: [
          { id: 5, name: 'quality', status: 'completed', conclusion: 'success',
            head_sha: 'a'.repeat(40), head_branch: 'feature/test',
            html_url: 'https://malicious.example/attack', created_at: '2026-11-20T10:00:00Z' }
        ] });
      }
    });
    const result = await reader.runs({ repository: 'owner/repo', branch: 'feature/test', limit: 5 });
    expect(scopeCalls).toEqual(['actions']);
    expect(new URL(urls[0]!).searchParams.get('branch')).toBe('feature/test');
    expect(result.runs).toEqual([{
      id: 5, name: 'quality', status: 'completed', conclusion: 'success',
      headSha: 'a'.repeat(40), branch: 'feature/test',
      htmlUrl: 'https://github.com/owner/repo/actions/runs/5',
      createdAt: '2026-11-20T10:00:00Z'
    }]);
  });

  it('rejects malformed refs and identifiers before making requests', async () => {
    let calls = 0;
    const reader = createGitHubAppCiReader({
      allowedRepositories: ['owner/repo'],
      getToken: async () => { calls++; return 'secret'; }
    });
    await expect(reader.runs({ repository: 'owner/repo', branch: 'feature/../escape' })).rejects.toMatchObject({ code: 'GITHUB_CI_INVALID_REF' });
    await expect(reader.jobs({ repository: 'owner/repo', runId: 0 })).rejects.toMatchObject({ code: 'GITHUB_CI_INVALID_ID' });
    await expect(reader.checks({ repository: 'owner/repo', sha: 'bad' })).rejects.toMatchObject({ code: 'GITHUB_CI_INVALID_SHA' });
    expect(calls).toBe(0);
  });

  it('reads scoped job and check information', async () => {
    const scopes: string[] = [];
    const reader = createGitHubAppCiReader({
      allowedRepositories: ['owner/repo'],
      getToken: async (_, scope) => { scopes.push(scope); return 'app-token'; },
      fetchImpl: async (url) => new URL(String(url)).pathname.endsWith('/jobs')
        ? json({ jobs: [{ id: 123, name: 'Node', status: 'completed', conclusion: 'success' }] })
        : json({ check_runs: [{ id: 22, name: 'test', status: 'completed', conclusion: 'success' }] })
    });
    await expect(reader.jobs({ repository: 'owner/repo', runId: 42 })).resolves.toMatchObject({
      jobs: [{ id: 123, conclusion: 'success' }]
    });
    await expect(reader.checks({ repository: 'owner/repo', sha: 'a'.repeat(40) })).resolves.toMatchObject({
      checks: [{ id: 22, name: 'test' }]
    });
    expect(scopes).toEqual(['actions', 'checks']);
  });

  it('fails with sanitized errors on GitHub upstream failure', async () => {
    const reader = createGitHubAppCiReader({
      allowedRepositories: ['owner/repo'],
      getToken: async () => 'app-token',
      fetchImpl: async () => json({ secret: 'do-not-reflect' }, 403)
    });
    await expect(reader.runs({ repository: 'owner/repo' })).rejects.toMatchObject({
      code: 'GITHUB_CI_ENDPOINT_FAILED'
    });
  });
});
