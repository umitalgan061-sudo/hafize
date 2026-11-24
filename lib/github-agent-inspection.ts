import { GitHubReadError } from './github-read.ts';
import type { createGitHubWorkspaceReader } from './github-workspace.ts';
import type { createGitHubWorkspaceExtra } from './github-workspace-extra.ts';
import type { createGitHubWorkspaceDetails } from './github-workspace-details.ts';

type Options = {
  reader: ReturnType<typeof createGitHubWorkspaceReader>;
  extra: ReturnType<typeof createGitHubWorkspaceExtra>;
  details: ReturnType<typeof createGitHubWorkspaceDetails>;
  allowedRepositories: readonly string[];
  token: string;
  allowPublicRead: boolean;
  fetchImpl?: typeof fetch;
};

const fields: Record<string, readonly string[]> = {
  repo: [], branches: ['limit'], commits: ['ref', 'limit'], pulls: ['state', 'limit'],
  directory: ['path', 'ref'], commit: ['sha'], pull: ['number'],
  compare: ['base', 'head'], checks: ['sha']
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GitHubReadError('INVALID_GITHUB_ARGUMENTS');
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Read-only current repository evidence; no arbitrary URLs, commands or mutation actions. */
export function createGitHubAgentInspection(options: Options) {
  const allowed = new Set(options.allowedRepositories.map(repo => repo.toLowerCase()));
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  return async (raw: unknown) => {
    const args = record(raw);
    const action = typeof args.action === 'string' ? args.action : '';
    if (!Object.hasOwn(fields, action) || Object.keys(args).some(key => !['action', 'repository', ...fields[action]].includes(key))) throw new GitHubReadError('INVALID_GITHUB_ARGUMENTS');
    const repository = typeof args.repository === 'string' ? args.repository.trim() : '';
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !allowed.has(repository.toLowerCase())) throw new GitHubReadError('GITHUB_REPO_NOT_ALLOWED', 403);
    if (!options.token && !options.allowPublicRead) throw new GitHubReadError('GITHUB_NOT_CONFIGURED', 503);
    const input = { ...args, repository, action };
    if (action === 'directory') return options.extra.directory(input);
    if (action === 'compare') return options.extra.compare({ repository, base: args.base, head: args.head });
    if (action === 'commit') return options.details.commit({ repository, sha: args.sha });
    if (action === 'pull') return options.details.pull({ repository, number: args.number });
    if (action !== 'checks') return options.reader.inspect(input);

    // Evidence is anchored to an exact commit, never to the latest unrelated run.
    const sha = string(args.sha);
    if (!/^[a-f0-9]{40}$/i.test(sha)) throw new GitHubReadError('INVALID_GITHUB_REF');
    const url = new URL('https://api.github.com/repos/' + repository.split('/').map(encodeURIComponent).join('/') + '/actions/runs');
    url.searchParams.set('head_sha', sha);
    url.searchParams.set('per_page', '20');
    const response = await fetchImpl(url, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(45_000),
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Hafize-AI', 'X-GitHub-Api-Version': '2022-11-28', ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}) }
    });
    if (!response.ok) throw new GitHubReadError('GITHUB_READ_FAILED', response.status);
    const data = record(await response.json());
    if (!Array.isArray(data.workflow_runs)) throw new GitHubReadError('INVALID_GITHUB_RESPONSE', 502);
    const runs = data.workflow_runs.slice(0, 20).flatMap(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const run = value as Record<string, unknown>;
      if (string(run.head_sha).toLowerCase() !== sha.toLowerCase()) return [];
      return [{ id: Number.isSafeInteger(run.id) ? run.id : null, name: string(run.name), headSha: string(run.head_sha), status: string(run.status, 40), conclusion: string(run.conclusion, 40) || null, htmlUrl: string(run.html_url, 500) }];
    });
    return { repository, sha, runs, observedRunCount: runs.length, totalCount: Number.isSafeInteger(data.total_count) ? data.total_count : null, note: 'Only observed workflow runs for this exact SHA; absence or partial success is not proof that all required checks passed.' };
  };
}
