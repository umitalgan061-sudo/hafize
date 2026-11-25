import {describe,it,expect,vi} from 'vitest';
import {createGitHubAgentRelease,releasePathAllowed,releaseAuthorizationForRequest,parseExplicitMergeCommand} from './github-agent-release.ts';
import type {createGitHubWorkspaceWriter} from './github-workspace-write.ts';
const repo='umitalgan061-sudo/hafize-siteler',sha='a'.repeat(40),base='b'.repeat(40);
function fixture(opts:{failed?:boolean;path?:string;draft?:boolean;mainFailed?:boolean;incomplete?:boolean;alreadyMerged?:boolean;lostMergeResponse?:boolean;wrongMergedHead?:boolean}={}){
 let mergedState=opts.alreadyMerged===true;
 const writer={configured:()=>true} as unknown as ReturnType<typeof createGitHubWorkspaceWriter>;
 const fetchImpl=vi.fn(async(u:URL|string,init?:RequestInit)=>{
  const p=new URL(String(u)).pathname;
  const json=(v:unknown)=>new Response(JSON.stringify(v));
  if(p.endsWith('/merge')){mergedState=true;if(opts.lostMergeResponse)throw Error('connection lost');return json({merged:true,sha:'c'.repeat(40)});}
  if(p.endsWith('/pulls/3'))return json({number:3,state:mergedState?'closed':'open',draft:opts.draft??false,merged:mergedState,merge_commit_sha:mergedState?'c'.repeat(40):null,mergeable:true,mergeable_state:'clean',changed_files:1,head:{ref:'hafize/auto-borsa',sha:mergedState&&opts.wrongMergedHead?'d'.repeat(40):sha,repo:{full_name:repo}},base:{ref:'main',sha:base,repo:{full_name:repo}}});
  if(p.endsWith('/heads/main'))return json({object:{sha:base}});
  if(p.endsWith('/files'))return json([{filename:opts.path??'borsa-worker/src/market.js',status:'modified'}]);
  if(p.endsWith('/actions/runs')){const head=new URL(String(u)).searchParams.get('head_sha');return json({total_count:opts.incomplete?2:1,workflow_runs:[{id:42,head_sha:head,head_branch:head===base?'main':'hafize/auto-borsa',path:'.github/workflows/borsa-worker-live.yml',status:'completed',conclusion:opts.failed?'failure':'success'}]});}
  if(p.endsWith('/runs/42/jobs'))return json({total_count:1,jobs:[{name:'test',head_sha:base,status:'completed',conclusion:opts.mainFailed?'failure':'success'}]});
  if(p.endsWith('/dispatches')){expect(JSON.parse(String(init?.body))).toEqual({ref:'main',inputs:{expected_sha:base}});return new Response(null,{status:204});}
  throw Error('unexpected '+p);
 }) as unknown as typeof fetch;
 const release=createGitHubAgentRelease({writer,allowedRepositories:[repo],fetchImpl});
 const authorization={repositories:[repo],actions:['open','merge','publish']};
 return {release,fetchImpl,authorization};
}
describe('bounded GitHub release',()=>{
 it('requires authenticated owner and scoped standing authorization; does not claim publish on merge',async()=>{
  const {release,fetchImpl,authorization}=fixture();
  const args={action:'merge',repository:repo,number:3,sha};
  await expect(release.execute(args,{ownerAuthorized:false,authorization})).rejects.toMatchObject({code:'RELEASE_NOT_AUTHORIZED_FOR_TASK'});
  expect(fetchImpl).not.toHaveBeenCalled();
  await expect(release.execute(args,{ownerAuthorized:true,authorization})).resolves.toMatchObject({merged:true,published:false,mergeCommitSha:'c'.repeat(40)});
  expect(fetchImpl).toHaveBeenCalled();
 });
 it('blocks failed CI, draft, and cross-project paths before mutation',async()=>{
  for(const [opts,code] of [[{failed:true},'RELEASE_CI_NOT_GREEN'],[{draft:true},'RELEASE_PR_NOT_READY'],[{path:'hafize-worker/src/index.js'},'RELEASE_PATH_NOT_ALLOWED']] as const){
   const {release,authorization}=fixture(opts);
   await expect(release.execute({action:'merge',repository:repo,number:3,sha},{ownerAuthorized:true,authorization})).rejects.toMatchObject({code});
   expect(authorization.repositories).toEqual([repo]);
  }
 });
 it('dispatches only known target at exact current main under standing authorization',async()=>{
  const {release,authorization}=fixture();
  await expect(release.execute({action:'publish',repository:repo,sha:base,target:'cloudflare'},{ownerAuthorized:true,authorization})).resolves.toMatchObject({dispatchAccepted:true,published:false});
  await expect(release.execute({action:'publish',repository:repo,sha,target:'cloudflare'},{ownerAuthorized:true,authorization})).rejects.toMatchObject({code:'RELEASE_BASE_MOVED'});
  expect(releasePathAllowed(repo,'.github/workflows/yayin.yml')).toBe(false);
  expect(releasePathAllowed(repo,'borsa-worker/src/auth.js')).toBe(false);
 });
});

it('limits no-prompt releases to explicit user requests and the correct project',()=>{
 expect(releaseAuthorizationForRequest('Borsa Günlüğü hatasını çöz, merge et ve canlıya al',true)).toEqual({repositories:[repo],actions:['open','merge','publish']});
 expect(releaseAuthorizationForRequest('Borsa Günlüğü sitesini incele',true)).toBeUndefined();
 expect(releaseAuthorizationForRequest('Borsa Günlüğü merge et ve canlıya al',false)).toBeUndefined();
 expect(releaseAuthorizationForRequest('Borsa Günlüğü merge etme',true)).toBeUndefined();
 expect(releaseAuthorizationForRequest('Borsa Günlüğü ve Retake merge et',true)).toBeUndefined();
 expect(releaseAuthorizationForRequest('Hafize-ua.web.app canlıya al',true)).toBeUndefined();
 expect(releaseAuthorizationForRequest("Hafize'yi geliştir ve merge et",true)?.actions).toEqual(['open','merge']);
});
it('rejects an unrelated repository even in an authenticated session',async()=>{
 const {release,fetchImpl}=fixture();
 await expect(release.execute({action:'merge',repository:repo,number:3,sha},{ownerAuthorized:true,authorization:{repositories:['umitalgan061-sudo/hafize'],actions:['merge']}})).rejects.toMatchObject({code:'RELEASE_NOT_AUTHORIZED_FOR_TASK'});
 expect(fetchImpl).not.toHaveBeenCalled();
});

it('blocks publish if exact main tests are missing or failed',async()=>{
 for(const opts of [{mainFailed:true},{incomplete:true}]){
  const {release,authorization,fetchImpl}=fixture(opts);
  await expect(release.execute({action:'publish',repository:repo,sha:base,target:'cloudflare'},{ownerAuthorized:true,authorization})).rejects.toBeDefined();
  expect((fetchImpl as any).mock.calls.some(([url]:[URL])=>url.pathname.endsWith('/dispatches'))).toBe(false);
 }
});
it('only explicit rollback requests grant the scoped rollback branch action',()=>{
 expect(releaseAuthorizationForRequest('Borsa Günlüğü son sürümü geri al',true)?.actions).toContain('rollback_pr');
 expect(releaseAuthorizationForRequest('Borsa Günlüğü geri alma',true)).toBeUndefined();
 expect(releasePathAllowed(repo,'borsa-worker/wrangler.toml')).toBe(false);
});
it('restores only allowed modified files to a separate branch, never merges or deploys',async()=>{
 const parent='d'.repeat(40),blob='e'.repeat(40),path='borsa-worker/src/market.js';
 const normalizeInput=vi.fn((_kind:string,payload:unknown)=>payload),createBranch=vi.fn(async()=>({branch:'new'})),commitFile=vi.fn(async()=>({commitSha:'f'.repeat(40)})),createPullRequest=vi.fn(async()=>({number:9}));
 const writer={configured:()=>true,normalizeInput,issueApproval:()=>({ticket:'bound'}),createBranch,commitFile,createPullRequest} as unknown as ReturnType<typeof createGitHubWorkspaceWriter>;
 const fetchImpl=vi.fn(async(url:URL|string)=>{
  const p=new URL(String(url)).pathname;
  if(p.endsWith('/heads/main'))return Response.json({object:{sha:base}});
  if(p.endsWith('/commits/'+base))return Response.json({sha:base,parents:[{sha:parent}],files:[{filename:path,sha:blob,status:'modified'}]});
  if(p.includes('/compare/'))return Response.json({total_commits:1,files:[{filename:path,sha:blob,status:'modified'}]});
  if(p.includes('/contents/'))return Response.json({type:'file',encoding:'base64',content:Buffer.from('old content').toString('base64'),size:11});
  throw Error('unexpected');
 }) as unknown as typeof fetch;
 const release=createGitHubAgentRelease({writer,allowedRepositories:[repo],fetchImpl});
 const args={action:'rollback_pr',repository:repo,sha:base};
 const authorization={repositories:[repo],actions:['rollback_pr']};
 await expect(release.execute(args,{ownerAuthorized:true,authorization})).resolves.toMatchObject({restoresParent:parent,merged:false,published:false,pull:{number:9}});
 expect(createBranch).toHaveBeenCalledTimes(1);expect(commitFile).toHaveBeenCalledTimes(1);expect(createPullRequest).toHaveBeenCalledTimes(1);
 expect(normalizeInput).toHaveBeenCalledWith('file',expect.objectContaining({path,content:'old content',existingSha:blob}));
});

it('authorizes only PR creation when a merge or publication is explicitly prohibited',()=>{
 const hafize='umitalgan061-sudo/hafize';
 expect(releaseAuthorizationForRequest(hafize+' incelemeye hazır gerçek PR oluştur. Şimdilik birleştirme veya canlı yayın yapma.',true)).toEqual({repositories:[hafize],actions:['open']});
 expect(releaseAuthorizationForRequest(hafize+' PR aç. Merge etme.',true)?.actions).toEqual(['open']);
 expect(releaseAuthorizationForRequest(hafize+' PR oluştur. Yeni PR açma.',true)).toBeUndefined();
 expect(releaseAuthorizationForRequest(hafize+' PR açma veya birleştirme yapma.',true)).toBeUndefined();
 expect(releaseAuthorizationForRequest(hafize+' PR oluştur, sadece incele.',true)).toBeUndefined();
 expect(releaseAuthorizationForRequest(hafize+' PR oluştur',false)).toBeUndefined();
 expect(releaseAuthorizationForRequest('Hafize-ua.web.app PR oluştur',true)).toBeUndefined();
});

it('distinguishes affirmative merge instructions from a separate prohibition',()=>{
 const r='umitalgan061-sudo/hafize';
 const message=r+' deposundaki PR #1051\'i merge et. Gerekli güncel kontrolleri yaparak birleştirme işlemini gerçekleştir.';
 expect(releaseAuthorizationForRequest(message,true)?.actions).toEqual(['open','merge']);
 expect(releaseAuthorizationForRequest(message+' Birleştirme yapma.',true)).toBeUndefined();
 expect(releaseAuthorizationForRequest(message,false)).toBeUndefined();
});
it('parses only a single exact user-authored structured merge command',()=>{
 const r='umitalgan061-sudo/hafize';
 const args={action:'merge',repository:r,number:1051,sha};
 const command='github_release aracını şu parametrelerle çalıştır:\n\n';
 expect(parseExplicitMergeCommand(r+' PR #1051 merge et.\n'+command+JSON.stringify(args))).toEqual(args);
 expect(parseExplicitMergeCommand(JSON.stringify(args))).toBeNull();
 expect(parseExplicitMergeCommand(command+JSON.stringify({...args,extra:true}))).toBeNull();
 expect(parseExplicitMergeCommand(command+JSON.stringify({...args,sha:'main'}))).toBeNull();
 expect(parseExplicitMergeCommand(command+JSON.stringify({...args,repository:'other/repo'}))).toBeNull();
 expect(parseExplicitMergeCommand(command+JSON.stringify({...args,action:'publish'}))).toBeNull();
 expect(parseExplicitMergeCommand(command+JSON.stringify(args)+'\n'+command+JSON.stringify(args))).toBeNull();
});

it('reconciles exact already merged PRs without repeating the write',async()=>{
 const args={action:'merge',repository:repo,number:3,sha};
 const {release,fetchImpl,authorization}=fixture({alreadyMerged:true});
 await expect(release.execute(args,{ownerAuthorized:true,authorization})).resolves.toMatchObject({existing:true,merged:true,mergeCommitSha:'c'.repeat(40),published:false});
 expect((fetchImpl as any).mock.calls.filter(([url]:[URL])=>url.pathname.endsWith('/merge'))).toHaveLength(0);
 const wrong=fixture({alreadyMerged:true,wrongMergedHead:true});
 await expect(wrong.release.execute(args,{ownerAuthorized:true,authorization:wrong.authorization})).rejects.toMatchObject({code:'RELEASE_MERGED_PR_MISMATCH'});
});
it('recovers a lost merge response by a read, never a second merge request',async()=>{
 const {release,fetchImpl,authorization}=fixture({lostMergeResponse:true});
 await expect(release.execute({action:'merge',repository:repo,number:3,sha},{ownerAuthorized:true,authorization})).resolves.toMatchObject({existing:true,reconciled:true,merged:true,mergeCommitSha:'c'.repeat(40)});
 expect((fetchImpl as any).mock.calls.filter(([url]:[URL])=>url.pathname.endsWith('/merge'))).toHaveLength(1);
});

describe('canonical Render publication',()=>{
 const hafize='umitalgan061-sudo/hafize';
 const authorization={repositories:[hafize],actions:['publish']};
 const writer={configured:()=>true} as unknown as ReturnType<typeof createGitHubWorkspaceWriter>;
 function renderFixture({live=false,hook='',failed=false,moved=false}:{live?:boolean;hook?:string;failed?:boolean;moved?:boolean}={}){
  const fetchImpl=vi.fn(async(u:URL|string)=>{
   const url=new URL(String(u));
   if(url.pathname.endsWith('/heads/main'))return Response.json({object:{sha:moved?sha:base}});
   if(url.pathname.endsWith('/actions/runs'))return Response.json({total_count:1,workflow_runs:[{head_sha:base,head_branch:'main',path:'.github/workflows/quality.yml',status:'completed',conclusion:failed?'failure':'success'}]});
   throw Error('Unexpected GitHub call');
  }) as unknown as typeof fetch;
  const renderFetch=vi.fn(async(u:URL|string)=>{
   const url=new URL(String(u));
   if(url.hostname==='hafize-free.onrender.com')return Response.json(url.pathname==='/release.json'?{commit:live?base:sha}:{revision:live?base:sha,status:'ok'});
   if(url.hostname==='api.render.com')return new Response(null,{status:202});
   throw Error('unexpected origin');
  }) as unknown as typeof fetch;
  return {release:createGitHubAgentRelease({writer,allowedRepositories:[hafize],fetchImpl,renderHook:hook,renderFetch}),renderFetch};
 }
 const args={action:'publish',repository:hafize,sha:base,target:'render'};
 it('verifies an already live exact revision without a secret or redeploy',async()=>{
  const f=renderFixture({live:true});
  await expect(f.release.execute(args,{ownerAuthorized:true,authorization})).resolves.toMatchObject({target:'render',published:true,existing:true});
  expect(f.renderFetch).toHaveBeenCalledTimes(2);
 });
 it('requires a service-specific configured hook and exact main with passed CI',async()=>{
  for(const [options,code] of [[{},'RENDER_DEPLOY_HOOK_NOT_CONFIGURED'],[{hook:'https://example.org/deploy/key'},'RENDER_DEPLOY_HOOK_INVALID'],[{hook:'https://api.render.com/deploy/srv-other?key=test'},'RENDER_DEPLOY_HOOK_INVALID'],[{failed:true},'RELEASE_MAIN_TESTS_NOT_GREEN'],[{moved:true},'RELEASE_BASE_MOVED']] as const){
   const f=renderFixture(options);
   await expect(f.release.execute(args,{ownerAuthorized:true,authorization})).rejects.toMatchObject({code});
   expect((f.renderFetch as any).mock.calls.every(([url]:[URL|string])=>new URL(String(url)).hostname==='hafize-free.onrender.com')).toBe(true);
  }
 });
 it('dispatches only the exact approved main SHA and never discloses the hook',async()=>{
  const f=renderFixture({hook:'https://api.render.com/deploy/srv-dc1valbl550s73flt7rg?key=fixture-only'});
  const result=await f.release.execute(args,{ownerAuthorized:true,authorization});
  expect(result).toMatchObject({target:'render',dispatchAccepted:true,published:false});
  expect(JSON.stringify(result)).not.toContain('fixture-only');
  const calls=(f.renderFetch as any).mock.calls;
  expect(new URL(String(calls[2][0])).searchParams.get('ref')).toBe(base);
  expect(calls[2][1]).toMatchObject({method:'POST',redirect:'error'});
 });
});
