import { describe, expect, it } from 'vitest';
import { createGitHubAppCiReader } from './github-app-ci.ts';

const response = (body: unknown, ok = true) => ({
  ok, json: async () => body
}) as Response;
const repo = 'owner/hafize';

describe('GitHub CI reader using existing App authenticated transport', () => {
  it('rejects repositories outside the configured read allowlist', async () => {
    let calls = 0;
    const reader = createGitHubAppCiReader({
      allowedRepositories: [repo],
      fetchImpl: async () => { calls++; return response({}); }
    });
    await expect(reader.runs({ repository: 'other/hafize' })).rejects.toMatchObject({
      code: 'GITHUB_CI_REPO_NOT_ALLOWED'
    });
    expect(calls).toBe(0);
  });

  it('lists bounded run metadata and does not trust URLs supplied by upstream', async () => {
    const requests: string[] = [];
    const reader = createGitHubAppCiReader({
      allowedRepositories: [repo],
      fetchImpl: async (url, init) => {
        requests.push(String(url));
        expect(init?.method).toBe('GET');
        expect(init?.redirect).toBe('error');
        return response({ workflow_runs: [{ id: 12, name: 'Quality',
          status: 'completed', conclusion: 'success', head_sha: 'a'.repeat(40),
          head_branch: 'feature/ci', html_url: 'https://evil.example/redirect'
        }] });
      }
    });
    const result = await reader.runs({ repository: repo, branch: 'feature/ci', limit: 1 });
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]!).searchParams.get('branch')).toBe('feature/ci');
    expect(result.runs).toMatchObject([{ id: 12, htmlUrl: 'https://github.com/owner/hafize/actions/runs/12' }]);
  });

  it('blocks invalid branches, SHAs and run IDs before fetching', async () => {
    let requests = 0;
    const reader = createGitHubAppCiReader({
      allowedRepositories: [repo],
      fetchImpl: async () => { requests++; return response({}); }
    });
    await expect(reader.runs({ repository: repo, branch: 'a/../b' })).rejects.toMatchObject({ code: 'GITHUB_CI_INVALID_REF' });
    await expect(reader.jobs({ repository: repo, runId: 0 })).rejects.toMatchObject({ code: 'GITHUB_CI_INVALID_ID' });
    await expect(reader.checks({ repository: repo, sha: 'bad' })).rejects.toMatchObject({ code: 'GITHUB_CI_INVALID_SHA' });
    expect(requests).toBe(0);
  });

  it('returns bounded jobs and checks without raw upstream response bodies', async () => {
    const reader = createGitHubAppCiReader({
      allowedRepositories: [repo],
      fetchImpl: async (url) => String(url).includes('/jobs')
        ? response({ jobs: [{ id: 33, name: 'Node 24', status: 'completed', conclusion: 'success', secret: 'nope' }] })
        : response({ check_runs: [{ id: 55, name: 'Tests', status: 'completed', conclusion: 'success' }] })
    });
    const jobs = await reader.jobs({ repository: repo, runId: 10 });
    expect(jobs.jobs[0]).toEqual({ id: 33, name: 'Node 24', status: 'completed', conclusion: 'success' });
    const checks = await reader.checks({ repository: repo, sha: 'b'.repeat(40) });
    expect(checks.checks[0]).toEqual({ id: 55, name: 'Tests', status: 'completed', conclusion: 'success' });
  });
});
