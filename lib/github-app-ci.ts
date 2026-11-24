/** Server-only CI metadata reader. Authentication is injected by GITHUB_FETCH;
 * do not use the browser's fetch here. App installation token scope is controlled
 * by the existing auth implementation; this reader enforces repo allowlists. */
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,179}$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const API = 'https://api.github.com';

export type GitHubAppCiAction = 'runs' | 'jobs' | 'checks';

export class GitHubAppCiError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code);
    this.name = 'GitHubAppCiError';
  }
}

type GitHubAppCiOptions = {
  readonly allowedRepositories: readonly string[];
  /** Server-side authenticated fetch supplied by the existing GitHub App runtime. */
  readonly fetchImpl: typeof fetch;
};

function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GitHubAppCiError('GITHUB_CI_INVALID_RESPONSE', 502);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function positiveId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new GitHubAppCiError('GITHUB_CI_INVALID_ID');
  return id;
}

export function createGitHubAppCiReader(options: GitHubAppCiOptions) {
  const fetchImpl = options.fetchImpl;
  const allowlist = new Set(options.allowedRepositories
    .map((r) => r.trim().toLowerCase())
    .filter((r) => REPOSITORY_PATTERN.test(r)));

  function allowedRepository(value: unknown): string {
    const repo = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!REPOSITORY_PATTERN.test(repo) || !allowlist.has(repo)) {
      throw new GitHubAppCiError('GITHUB_CI_REPO_NOT_ALLOWED', 403);
    }
    return repo;
  }

  async function read(repository: string, pathname: string, query?: URLSearchParams) {
    const url = new URL(pathname, API);
    if (query) url.search = query.toString();
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Hafize-GitHub-App-CI'
        },
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) throw new Error('upstream request failed');
      return obj(await response.json());
    } catch {
      // Never forward upstream response bodies containing possible sensitive data.
      throw new GitHubAppCiError('GITHUB_CI_ENDPOINT_FAILED', 502);
    }
  }

  async function runs(input: { repository: unknown; branch?: unknown; limit?: unknown }) {
    const repo = allowedRepository(input.repository);
    const branch = input.branch == null ? '' : String(input.branch).trim();
    if (branch && (!SAFE_REF_PATTERN.test(branch) || branch.includes('..') || branch.includes('//') || branch.endsWith('/'))) {
      throw new GitHubAppCiError('GITHUB_CI_INVALID_REF');
    }
    const limit = Math.min(20, Math.max(1, Number.isInteger(input.limit) ? Number(input.limit) : 10));
    const search = new URLSearchParams({ per_page: String(limit) });
    if (branch) search.set('branch', branch);
    const payload = await read(repo, '/repos/' + repo + '/actions/runs', search);
    if (!Array.isArray(payload.workflow_runs)) throw new GitHubAppCiError('GITHUB_CI_INVALID_RESPONSE', 502);
    return {
      repository: repo, branch,
      runs: payload.workflow_runs.slice(0, limit).map((r: unknown) => {
        const item = obj(r);
        const id = positiveId(item.id);
        return {
          id, name: stringValue(item.name, 120),
          status: stringValue(item.status, 30), conclusion: stringValue(item.conclusion, 30),
          headSha: stringValue(item.head_sha, 40), branch: stringValue(item.head_branch, 180),
          htmlUrl: 'https://github.com/' + repo + '/actions/runs/' + id,
          createdAt: stringValue(item.created_at, 40)
        };
      })
    };
  }

  async function jobs(input: { repository: unknown; runId: unknown }) {
    const repo = allowedRepository(input.repository);
    const runId = positiveId(input.runId);
    const payload = await read(repo, '/repos/' + repo + '/actions/runs/' + runId + '/jobs', new URLSearchParams({ per_page: '30' }));
    if (!Array.isArray(payload.jobs)) throw new GitHubAppCiError('GITHUB_CI_INVALID_RESPONSE', 502);
    return {
      repository: repo, runId,
      jobs: payload.jobs.slice(0, 30).map((j: unknown) => {
        const item = obj(j);
        return {
          id: positiveId(item.id), name: stringValue(item.name, 120),
          status: stringValue(item.status, 30), conclusion: stringValue(item.conclusion, 30)
        };
      })
    };
  }

  async function checks(input: { repository: unknown; sha: unknown }) {
    const repo = allowedRepository(input.repository);
    const sha = typeof input.sha === 'string' ? input.sha.trim().toLowerCase() : '';
    if (!COMMIT_SHA_PATTERN.test(sha)) throw new GitHubAppCiError('GITHUB_CI_INVALID_SHA');
    const payload = await read(repo, '/repos/' + repo + '/commits/' + sha + '/check-runs', new URLSearchParams({ per_page: '30' }));
    if (!Array.isArray(payload.check_runs)) throw new GitHubAppCiError('GITHUB_CI_INVALID_RESPONSE', 502);
    return {
      repository: repo, sha,
      checks: payload.check_runs.slice(0, 30).map((j: unknown) => {
        const item = obj(j);
        return {
          id: positiveId(item.id), name: stringValue(item.name, 120),
          status: stringValue(item.status, 30), conclusion: stringValue(item.conclusion, 30)
        };
      })
    };
  }

  return Object.freeze({ runs, jobs, checks });
}
