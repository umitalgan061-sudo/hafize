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
  project: ['path'], repo: [], branches: ['limit'], commits: ['ref', 'limit'], pulls: ['state', 'limit'],
  directory: ['path', 'ref'], commit: ['sha'], pull: ['number'],
  compare: ['base', 'head'], checks: ['sha'], jobs: ['runId']
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
    const input = { repository, action, path: args.path, ref: args.ref, state: args.state, limit: args.limit };
    // Catalog paths are display paths (including "." or a trailing slash).
    // Normalize only directory reads; existing path/allowlist validation stays in force.
    const directoryPath = typeof args.path === 'string' ? args.path.trim().replace(/\/+$/, '') : args.path;
    const safeDirectoryPath = directoryPath === '.' ? '' : directoryPath;
    if (action === 'directory') return options.extra.directory({ ...input, path: safeDirectoryPath });
    if (action === 'project') {
      // One bounded discovery call gives the model enough evidence to proceed
      // instead of repeatedly guessing root folders, branches and pull state.
      const capture = async (fn: () => Promise<unknown>) => {
        try { return { ok: true as const, value: await fn() }; }
        catch (error) {
          const e = error as { code?: unknown; status?: unknown };
          return { ok: false as const, error: typeof e?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(e.code) ? e.code : 'GITHUB_PROJECT_READ_FAILED', status: typeof e?.status === 'number' ? e.status : null };
        }
      };
      const meta = await options.reader.inspect({ repository, action: 'repo' });
      const ref = typeof meta.defaultBranch === 'string' ? meta.defaultBranch : 'main';
      const [directory, root, commits, pulls] = await Promise.all([
        capture(() => options.extra.directory({ repository, path: safeDirectoryPath, ref })),
        typeof safeDirectoryPath === 'string' && safeDirectoryPath ? capture(() => options.extra.directory({ repository, ref })) : Promise.resolve(null),
        capture(() => options.reader.inspect({ repository, action: 'commits', ref, limit: 1 })),
        capture(() => options.reader.inspect({ repository, action: 'pulls', state: 'open', limit: 10 }))
      ]);
      return { repository, ref, meta, directory, root, commits, pulls, partial: [directory,root,commits,pulls].some(x=>x?.ok===false), note: 'Read-only project preflight; no code modification, CI run, merge or deployment. Root hosting configuration can differ from source directory. Verify checks for exact SHA separately.' };
    }
    if (action === 'compare') return options.extra.compare({ repository, base: args.base, head: args.head });
    if (action === 'commit') return options.details.commit({ repository, sha: args.sha });
    if (action === 'pull') return options.details.pull({ repository, number: args.number });
    if(action==='jobs'){
      const runId=args.runId;
      if(typeof runId!=='number'||!Number.isSafeInteger(runId)||runId<1)throw new GitHubReadError('INVALID_GITHUB_ARGUMENTS');
      const url=new URL('https://api.github.com/repos/'+repository.split('/').map(encodeURIComponent).join('/')+'/actions/runs/'+runId+'/jobs?per_page=100');
      const response=await fetchImpl(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(30_000),headers:{Accept:'application/vnd.github+json','User-Agent':'Hafize-AI','X-GitHub-Api-Version':'2022-11-28',...(options.token?{Authorization:'Bearer '+options.token}:{})}});
      if(!response.ok)throw new GitHubReadError('GITHUB_READ_FAILED',response.status);
      const data=record(await response.json());
      if(!Array.isArray(data.jobs))throw new GitHubReadError('INVALID_GITHUB_RESPONSE',502);
      return {repository,runId,totalCount:data.total_count,jobs:data.jobs.slice(0,100).map(v=>{const j=record(v);return {id:j.id,name:string(j.name),status:string(j.status),conclusion:string(j.conclusion)||null,steps:Array.isArray(j.steps)?j.steps.slice(0,80).map(v=>{const s=record(v);return {name:string(s.name),status:string(s.status),conclusion:string(s.conclusion)||null};}):[]};})};
    }
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
