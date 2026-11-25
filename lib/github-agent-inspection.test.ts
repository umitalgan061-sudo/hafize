import { describe, expect, it, vi } from 'vitest';
import { createGitHubAgentInspection } from './github-agent-inspection.ts';
import { createGitHubWorkspaceReader } from './github-workspace.ts';
import { createGitHubWorkspaceExtra } from './github-workspace-extra.ts';
import { createGitHubWorkspaceDetails } from './github-workspace-details.ts';

const repository = 'owner/example';
const sha = 'a'.repeat(40);
function fixture() {
  const fetchImpl = vi.fn(async (url: URL | string, init?: RequestInit) => {
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    const u = new URL(String(url));
    expect(u.origin).toBe('https://api.github.com');
    let data: unknown = { name: 'example', full_name: repository, default_branch: 'main', visibility: 'public' };
    if (u.pathname.includes('/contents')) data = [{ name: 'index.html', path: 'borsa-gunlugu/index.html', type: 'file', sha }];
    if (u.pathname.endsWith('/commits')) data = [{ sha, commit: { message: 'main revision' } }];
    if (u.pathname.endsWith('/pulls')) data = [];
    if (u.pathname.endsWith('/pulls/64')) data = { number: 64, title: 'fix', state: 'closed', merged: true, merge_commit_sha: sha, head: { ref: 'feature', sha }, base: { ref: 'main', sha }, html_url: 'https://github.com/owner/example/pull/64' };
    if (u.pathname.endsWith('/actions/runs')) {
      expect(u.searchParams.get('head_sha')).toBe(sha);
      data = { total_count: 2, workflow_runs: [{ id: 1, head_sha: sha, status: 'completed', conclusion: 'success' }, { id: 2, head_sha: 'b'.repeat(40), status: 'completed', conclusion: 'success' }] };
    }
    return new Response(JSON.stringify(data), { status: 200 });
  }) as unknown as typeof fetch;
  const opts = { token: '', allowPublicRead: true, allowedRepositories: [repository], fetchImpl };
  const inspect = createGitHubAgentInspection({ ...opts, reader: createGitHubWorkspaceReader(opts), extra: createGitHubWorkspaceExtra(opts), details: createGitHubWorkspaceDetails(opts) });
  return { inspect, fetchImpl };
}
describe('GitHub agent inspection', () => {
  it('reads repository and real merged PR evidence without credentials', async () => {
    const { inspect } = fixture();
    expect(await inspect({ action: 'repo', repository })).toMatchObject({ defaultBranch: 'main', visibility: 'public' });
    expect(await inspect({ action: 'pull', repository, number: 64 })).toMatchObject({ merged: true, mergeCommitSha: sha, headSha: sha });
  });
  it('rejects external repositories, write actions, arbitrary URLs and ambiguous SHA', async () => {
    const { inspect, fetchImpl } = fixture();
    for (const args of [{ action: 'repo', repository: 'other/repo' }, { action: 'merge', repository }, { action: 'repo', repository, url: 'https://example.com' }, { action: 'checks', repository, sha: 'main' }]) await expect(inspect(args)).rejects.toBeDefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('returns only CI evidence for the exact requested SHA', async () => {
    const { inspect } = fixture();
    const result = await inspect({ action: 'checks', repository, sha });
    expect(result).toMatchObject({ sha, observedRunCount: 1, totalCount: 2, runs: [{ id: 1, headSha: sha, conclusion: 'success' }] });
  });
});

it('discovers source directory, branch, current commit and open PRs in one bounded read', async()=> {
 const { inspect, fetchImpl } = fixture();
 const result = await inspect({action:'project',repository,path:'borsa-gunlugu/'});
 expect(result).toMatchObject({ref:'main',directory:{ok:true,value:{path:'borsa-gunlugu'}},root:{ok:true},commits:{ok:true,value:{commits:[{sha}]}},pulls:{ok:true,value:{pullRequests:[]}},partial:false});
 expect(fetchImpl).toHaveBeenCalledTimes(5);
 expect(await inspect({action:'directory',repository,path:'.'})).toMatchObject({path:''});
 await expect(inspect({action:'project',repository:'other/repo',path:'borsa-gunlugu/'})).rejects.toMatchObject({code:'GITHUB_REPO_NOT_ALLOWED'});
});

it('waits only for exact SHA evidence and does not treat partial run lists as complete',async()=>{
 const {inspect,fetchImpl}=fixture();
 const result=await inspect({action:'wait_checks',repository,sha,waitSeconds:1});
 expect(result).toMatchObject({wait:{complete:false,observedSuccess:false,timedOut:true}});
 expect(fetchImpl).toHaveBeenCalledTimes(2);
 const abort=new AbortController();abort.abort();await expect(inspect({action:'wait_checks',repository,sha},abort.signal)).rejects.toBeDefined();
});
