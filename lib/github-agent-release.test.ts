import {describe,it,expect,vi} from 'vitest';
import {createGitHubAgentRelease,releasePathAllowed,releaseAuthorizationForRequest} from './github-agent-release.ts';
import type {createGitHubWorkspaceWriter} from './github-workspace-write.ts';
const repo='umitalgan061-sudo/hafize-siteler',sha='a'.repeat(40),base='b'.repeat(40);
function fixture(opts:{failed?:boolean;path?:string;draft?:boolean}={}){
 const writer={configured:()=>true} as unknown as ReturnType<typeof createGitHubWorkspaceWriter>;
 const fetchImpl=vi.fn(async(u:URL|string,init?:RequestInit)=>{
  const p=new URL(String(u)).pathname;
  const json=(v:unknown)=>new Response(JSON.stringify(v));
  if(p.endsWith('/merge'))return json({merged:true,sha:'c'.repeat(40)});
  if(p.endsWith('/pulls/3'))return json({state:'open',draft:opts.draft??false,merged:false,mergeable:true,mergeable_state:'clean',changed_files:1,head:{ref:'hafize/auto-borsa',sha,repo:{full_name:repo}},base:{ref:'main',sha:base,repo:{full_name:repo}}});
  if(p.endsWith('/heads/main'))return json({object:{sha:base}});
  if(p.endsWith('/files'))return json([{filename:opts.path??'borsa-worker/src/market.js',status:'modified'}]);
  if(p.endsWith('/actions/runs'))return json({total_count:1,workflow_runs:[{head_sha:sha,path:'.github/workflows/borsa-worker-live.yml',status:'completed',conclusion:opts.failed?'failure':'success'}]});
  if(p.endsWith('/dispatches'))return new Response(null,{status:204});
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
