import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createGitHubAgentDevelopment } from './github-agent-development.ts';
import { createGitHubWorkspaceWriter } from './github-workspace-write.ts';

type Writer = ReturnType<typeof createGitHubWorkspaceWriter>;
const REPOSITORY = 'umitalgan061-sudo/hafize';
const BRANCH = 'hafize/auto-safe-change';

function fixture() {
  const writer = {
    configured: vi.fn(() => true),
    normalizeInput: vi.fn((_kind: unknown, input: unknown) => input),
    issueApproval: vi.fn(() => ({ ticket: 'single-use-ticket' })),
    createBranch: vi.fn(async () => ({ action: 'branch', branch: BRANCH })),
    commitFile: vi.fn(async () => ({ action: 'file', branch: BRANCH })),
    prepareFilePatch: vi.fn(async (input: Record<string,unknown>) => ({...input, content:'complete preserved content'})),
    verifyFileCommit: vi.fn(async (_input: unknown, result: object) => ({...result,verified:true})),
    createPullRequest: vi.fn(async () => ({ action: 'pull', draft: true }))
  };
  const tool = createGitHubAgentDevelopment({
    writer: writer as unknown as Writer,
    allowedRepositories: [REPOSITORY]
  });
  const requestApproval = vi.fn(async () => true);
  return { writer, tool, requestApproval };
}

describe('GitHub App agent development boundary', () => {
  it('exposes readiness only with an allowlisted and configured writer', () => {
    const { tool, writer } = fixture();
    expect(tool.enabled()).toBe(true);
    writer.configured.mockReturnValue(false);
    expect(tool.enabled()).toBe(false);
    expect(createGitHubAgentDevelopment({ writer: writer as unknown as Writer, allowedRepositories: [] }).enabled()).toBe(false);
  });

  it('requires the interactive approval channel before a write', async () => {
    const { tool, writer } = fixture();
    await expect(tool.execute({ operation: 'branch', repository: REPOSITORY, branch: BRANCH }, {}))
      .rejects.toMatchObject({ code: 'GITHUB_WRITE_APPROVAL_REQUIRED' });
    expect(writer.issueApproval).not.toHaveBeenCalled();
  });

  it('uses standing owner approval for feature branch and draft PR without a separate prompt', async () => {
    const { tool, writer, requestApproval } = fixture();
    const result = await tool.execute({
      operation: 'branch', repository: REPOSITORY, branch: BRANCH
    }, { safeAutonomy: true });
    expect(result).toMatchObject({ action: 'branch' });
    expect(writer.issueApproval).toHaveBeenCalledWith('branch', {
      repository: REPOSITORY, branch: BRANCH, fromRef: 'main'
    }, true);
    expect(requestApproval).not.toHaveBeenCalled();
    await tool.execute({
      operation: 'pull', repository: REPOSITORY, branch: BRANCH, title: 'Safe review'
    }, { safeAutonomy: true });
    expect(writer.createPullRequest).toHaveBeenCalledWith('single-use-ticket',
      expect.objectContaining({ head: BRANCH, base: 'main', draft: true }));
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it('even in safe autonomy rejects unauthorized repos, branches and arbitrary write controls', async () => {
    const { tool, writer } = fixture();
    await expect(tool.execute({
      operation: 'file', repository: REPOSITORY, branch: 'main',
      path: 'src/safe.ts', message: 'edit', content: 'ok'
    }, { safeAutonomy: true })).rejects.toMatchObject({ code: 'INVALID_GITHUB_BRANCH' });
    await expect(tool.execute({
      operation: 'branch', repository: 'umitalgan061-sudo/retake', branch: BRANCH
    }, { safeAutonomy: true })).rejects.toMatchObject({ code: 'GITHUB_REPO_NOT_ALLOWED' });
    await expect(tool.execute({
      operation: 'pull', repository: REPOSITORY, branch: BRANCH,
      title: 'unsafe', draft: false
    }, { safeAutonomy: true })).rejects.toMatchObject({ code: 'INVALID_GITHUB_ARGUMENTS' });
    expect(writer.issueApproval).not.toHaveBeenCalled();
  });

  it('only accepts a separate Hafize feature branch and its allowlisted repo', async () => {
    const { tool, writer, requestApproval } = fixture();
    for (const branch of ['main', 'feature/unsafe', 'hafize/auto-../escape', 'hafize/auto-bad.lock']) {
      await expect(tool.execute({ operation: 'branch', repository: REPOSITORY, branch }, { requestApproval }))
        .rejects.toMatchObject({ code: 'INVALID_GITHUB_BRANCH' });
    }
    await expect(tool.execute({ operation: 'branch', repository: 'umitalgan061-sudo/retake', branch: BRANCH }, { requestApproval }))
      .rejects.toMatchObject({ code: 'GITHUB_REPO_NOT_ALLOWED' });
    expect(requestApproval).not.toHaveBeenCalled();
    expect(writer.issueApproval).not.toHaveBeenCalled();
  });

  it('refuses model-supplied extra control fields', async () => {
    const { tool, writer, requestApproval } = fixture();
    await expect(tool.execute({ operation: 'pull', repository: REPOSITORY, branch: BRANCH, title: 'Change', draft: false }, { requestApproval }))
      .rejects.toMatchObject({ code: 'INVALID_GITHUB_ARGUMENTS' });
    expect(writer.issueApproval).not.toHaveBeenCalled();
  });

  it('creates a branch from main only AFTER per-action approval', async () => {
    const { tool, writer, requestApproval } = fixture();
    requestApproval.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const input = { operation: 'branch', repository: REPOSITORY, branch: BRANCH };
    await expect(tool.execute(input, { requestApproval }))
      .rejects.toMatchObject({ code: 'GITHUB_WRITE_APPROVAL_REQUIRED' });
    expect(writer.createBranch).not.toHaveBeenCalled();
    await tool.execute(input, { requestApproval });
    const payload = { repository: REPOSITORY, branch: BRANCH, fromRef: 'main' };
    expect(writer.normalizeInput).toHaveBeenCalledWith('branch', payload);
    expect(writer.issueApproval).toHaveBeenCalledWith('branch', payload, true);
    expect(writer.createBranch).toHaveBeenCalledWith('single-use-ticket', payload);
  });

  it('ties an exact file body and expected SHA to a distinct explicit approval', async () => {
    const { tool, writer, requestApproval } = fixture();
    const content = 'export const newValue = 1;\n';
    await tool.execute({
      operation: 'file', repository: REPOSITORY, branch: BRANCH,
      path: 'lib/example.ts', content, message: 'feat: example', existingSha: 'a'.repeat(40)
    }, { requestApproval });
    const approval = requestApproval.mock.calls[0]![0];
    expect(approval.kind).toBe('github.development.file');
    expect(approval.detail).toContain('SHA-256:');
    expect(approval.detail).toContain('lib/example.ts');
    expect(writer.commitFile).toHaveBeenCalledWith('single-use-ticket', expect.objectContaining({
      path: 'lib/example.ts', existingSha: 'a'.repeat(40), content
    }));
  });

  it('forces every agent pull request to be draft and target main', async () => {
    const { tool, writer, requestApproval } = fixture();
    await tool.execute({
      operation: 'pull', repository: REPOSITORY, branch: BRANCH,
      title: 'Safe change', body: 'Tests pending review'
    }, { requestApproval });
    expect(writer.createPullRequest).toHaveBeenCalledWith('single-use-ticket', {
      repository: REPOSITORY, head: BRANCH, base: 'main',
      title: 'Safe change', body: 'Tests pending review', draft: true
    });
  });

  it('does not ask approval or issue tickets when core writer rejects secrets', async () => {
    const { tool, writer, requestApproval } = fixture();
    writer.normalizeInput.mockImplementationOnce(() => { throw Object.assign(new Error('blocked'), { code: 'GITHUB_CONTENT_CREDENTIAL_BLOCKED' }); });
    await expect(tool.execute({
      operation: 'file', repository: REPOSITORY, branch: BRANCH,
      path: '.env', content: 'DUMMY=1', message: 'unsafe'
    }, { requestApproval })).rejects.toMatchObject({ code: 'GITHUB_CONTENT_CREDENTIAL_BLOCKED' });
    expect(requestApproval).not.toHaveBeenCalled();
    expect(writer.issueApproval).not.toHaveBeenCalled();
  });
});

it('restricts optional monorepo development to the Borsa source directory',async()=>{
 const {writer}=fixture();
 const repository='umitalgan061-sudo/hafize-siteler';
 const tool=createGitHubAgentDevelopment({writer:writer as unknown as Writer,allowedRepositories:[repository],sourcePathRestrictions:{[repository]:'borsa-gunlugu/'}});
 for(const path of ['firebase.json','.github/workflows/live.yml','hafize-uyum/index.html','borsa-gunlugu/../firebase.json','borsa-gunlugu/']) {
  await expect(tool.execute({operation:'file',repository,branch:BRANCH,path,content:'ok',message:'edit'},{safeAutonomy:true})).rejects.toMatchObject({code:'GITHUB_REPO_PATH_NOT_ALLOWED'});
 }
 expect(writer.issueApproval).not.toHaveBeenCalled();
 await tool.execute({operation:'file',repository,branch:BRANCH,path:'borsa-gunlugu/src/main.js',content:'// safe',message:'edit'},{safeAutonomy:true});
 expect(writer.commitFile).toHaveBeenCalled();
});

it('allows Borsa frontend and worker only when explicitly configured',async()=>{
 const {writer}=fixture();
 const repository='umitalgan061-sudo/hafize-siteler';
 const tool=createGitHubAgentDevelopment({writer:writer as unknown as Writer,allowedRepositories:[repository],sourcePathRestrictions:{[repository]:['borsa-gunlugu/','borsa-worker/']}});
 for(const path of ['borsa-worker/wrangler.toml','borsa-gunlugu/src/main.js']) await tool.execute({operation:'file',repository,branch:BRANCH,path,content:'safe',message:'edit'},{safeAutonomy:true});
 for(const path of ['.github/workflows/yayin.yml','firebase.json','hafize-worker/src/index.js','borsa-worker/../firebase.json']) await expect(tool.execute({operation:'file',repository,branch:BRANCH,path,content:'safe',message:'edit'},{safeAutonomy:true})).rejects.toMatchObject({code:'GITHUB_REPO_PATH_NOT_ALLOWED'});
});

it('generates a fresh safe branch only for branch creation; no implicit write target',async()=>{
 const {tool,writer}=fixture();
 await tool.execute({operation:'branch',repository:REPOSITORY},{safeAutonomy:true});
 const first=writer.normalizeInput.mock.calls[0]![1] as {branch:string};
 expect(first.branch).toMatch(/^hafize\/auto-[a-f0-9]{32}$/);
 await tool.execute({operation:'branch',repository:REPOSITORY},{safeAutonomy:true});
 expect(writer.normalizeInput.mock.calls[1]![1]).not.toEqual(first);
 await expect(tool.execute({operation:'file',repository:REPOSITORY,path:'public/x.js',content:'ok',message:'edit'},{safeAutonomy:true})).rejects.toMatchObject({code:'INVALID_GITHUB_ARGUMENTS'});
});

it('routes patch through the trusted writer and verifies the commit', async()=>{
 const {tool,writer}=fixture();
 const result=await tool.execute({operation:'file',repository:REPOSITORY,branch:BRANCH,path:'app.js',existingSha:'a'.repeat(40),find:'old block',replace:'new block',message:'edit'},{safeAutonomy:true});
 expect(writer.prepareFilePatch).toHaveBeenCalledWith(expect.objectContaining({find:'old block',replace:'new block',existingSha:'a'.repeat(40)}));
 expect(writer.commitFile).toHaveBeenCalledWith('single-use-ticket',expect.objectContaining({content:'complete preserved content'}));
 expect(writer.verifyFileCommit).toHaveBeenCalled();
 expect(result.verified).toBe(true);
 await expect(tool.execute({operation:'file',repository:REPOSITORY,branch:BRANCH,path:'app.js',find:'old',replace:'new',message:'edit'},{safeAutonomy:true})).rejects.toMatchObject({code:'INVALID_GITHUB_ARGUMENTS'});
});

it('creates a new file through the real writer without an existing blob SHA',async()=>{
 const writes:Record<string,unknown>[]=[];
 const writer=createGitHubWorkspaceWriter({token:'test-token',allowedRepositories:[REPOSITORY],fetchImpl:async(url,init)=>{
  if(init?.method==='PUT'){writes.push(JSON.parse(String(init.body)));return new Response(JSON.stringify({content:{sha:'b'.repeat(40)},commit:{sha:'c'.repeat(40)}}));}
  if(String(url).includes('/contents/')){
   const bytes=Buffer.from('export const value = 1;\n','utf8');
   const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
   return new Response(JSON.stringify({type:'file',sha,size:bytes.length}));
  }
  return new Response(JSON.stringify({default_branch:'main',ref:'refs/heads/'+BRANCH,object:{sha:'a'.repeat(40)}}));
 }});
 const tool=createGitHubAgentDevelopment({writer,allowedRepositories:[REPOSITORY]});
 await tool.execute({operation:'file',repository:REPOSITORY,branch:BRANCH,path:'lib/example.ts',content:'export const value = 1;\n',message:'feat: example'},{safeAutonomy:true});
 expect(writes).toHaveLength(1);expect(writes[0]).not.toHaveProperty('sha');
 expect(Buffer.from(String(writes[0]!.content),'base64').toString()).toBe('export const value = 1;\n');
});
