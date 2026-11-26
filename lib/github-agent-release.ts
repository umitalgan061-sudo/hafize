import {randomUUID} from 'node:crypto';
import { GitHubAppCiError } from './github-app-ci.ts';
import type { createGitHubWorkspaceWriter } from './github-workspace-write.ts';
type Writer=ReturnType<typeof createGitHubWorkspaceWriter>;
import { matchOwnerProjects } from './owner-project-catalog.ts';
export type ReleaseAuthorization={readonly repositories:readonly string[];readonly actions:readonly string[];readonly hafizePublishTarget?:'render'|'firebase'};
type Context={ownerAuthorized:boolean;authorization?:ReleaseAuthorization;signal?:AbortSignal;reserveRender?:()=>boolean};
const HAFIZE='umitalgan061-sudo/hafize', SITES='umitalgan061-sudo/hafize-siteler';
const SHA=/^[a-f0-9]{40}$/i;
const BRANCH=/^hafize\/auto-[a-z0-9][a-z0-9._-]{0,100}$/;
const fail=(code:string,status=400):never=>{throw new GitHubAppCiError(code,status);};
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:fail('RELEASE_INVALID_RESPONSE',502);
const exact=(v:unknown)=>typeof v==='string'&&SHA.test(v)?v.toLowerCase():fail('RELEASE_EXACT_SHA_REQUIRED');
const id=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?v:fail('RELEASE_INVALID_PR');
const safeBranch=(v:unknown)=>typeof v==='string'&&BRANCH.test(v)&&!v.includes('..')&&!v.endsWith('.lock')?v:fail('INVALID_GITHUB_BRANCH');
const text=(v:unknown,n:number)=>typeof v==='string'&&v.trim()&&v.length<=n?v.trim():fail('INVALID_GITHUB_ARGUMENTS');
/** Production merge intentionally starts with bounded source scopes; no policy, secret, CI, dependency or infra editing. */
export function releasePathAllowed(repo:string,path:string){
 if(path.split('/').some(x=>!x||x==='.'||x==='..'||x.startsWith('.'))||path.includes('\\')||/(?:secret|credential|private[-_]?key|token|auth|permission|policy|security)/i.test(path))return false;
 if(repo===HAFIZE)return /^public\/(?:typed\/)?[a-zA-Z0-9_/-][a-zA-Z0-9_./-]*\.(?:css|html|ts|js|svg)$/.test(path)&&!/(?:sw|service-worker|theme-init|composer-focus-guard)\.(?:ts|js)$/.test(path);
 if(repo===SITES)return /^(?:borsa-gunlugu|borsa-worker)\/src\/[a-zA-Z0-9_/-][a-zA-Z0-9_./-]*\.(?:js|ts|css|html)$/.test(path);
 return false;
}
const RENDER_ORIGIN='https://hafize-free.onrender.com';
const RENDER_SERVICE='srv-dc1valbl550s73flt7rg';
export function createGitHubAgentRelease({writer,allowedRepositories,fetchImpl,renderHook='',renderFetch=globalThis.fetch,otherActiveTasks=()=>false}:{writer:Writer;allowedRepositories:readonly string[];fetchImpl:typeof fetch;renderHook?:string;renderFetch?:typeof fetch;otherActiveTasks?:()=>boolean}){
 const allowed=new Set<string>(allowedRepositories.map(r=>r.toLowerCase()).filter(r=>r===HAFIZE||r===SITES));
 const enabled=()=>allowed.size>0&&writer.configured();
 async function api(repo:string,path:string,method='GET',body?:unknown,signal?:AbortSignal){
  const r=await fetchImpl(new URL('https://api.github.com/repos/'+repo+path),{method,redirect:'error',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Hafize-Release','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  if(!r.ok){await r.body?.cancel().catch(()=>{});fail(r.status===403&&method==='POST'&&path.endsWith('/dispatches')?'RELEASE_WORKFLOW_DISPATCH_FORBIDDEN':'RELEASE_GITHUB_HTTP_FAILED',r.status);}
  return r.status===204?null:await r.json();
 }
 async function current(repo:string,signal?:AbortSignal){
  return exact(obj(await api(repo,'/git/ref/heads/main','GET',undefined,signal)).object?.sha);
 }
 // Read-only reconciliation for an exact PR and exact requested head. This
 // can recover a successful merge after a lost response without another PUT.
 async function observedMerge(repo:string,number:number,sha:string,signal?:AbortSignal){
  const pr=obj(await api(repo,'/pulls/'+number,'GET',undefined,signal));
  if(pr.merged!==true)return null;
  if(pr.number!==number||pr.state!=='closed'||pr.base?.ref!=='main'||pr.base?.repo?.full_name?.toLowerCase()!==repo||pr.head?.repo?.full_name?.toLowerCase()!==repo||exact(pr.head?.sha)!==sha)fail('RELEASE_MERGED_PR_MISMATCH',409);
  safeBranch(pr.head.ref);
  return {action:'merge',repository:repo,number,headSha:sha,mergeCommitSha:exact(pr.merge_commit_sha),merged:true,published:false,existing:true};
 }
 async function preflight(repo:string,number:number,sha:string,signal?:AbortSignal){
  const pr=obj(await api(repo,'/pulls/'+number,'GET',undefined,signal));
  if(pr.state!=='open'||pr.draft!==false||pr.merged!==false||pr.base?.ref!=='main'||pr.base?.repo?.full_name?.toLowerCase()!==repo||pr.head?.repo?.full_name?.toLowerCase()!==repo||exact(pr.head?.sha)!==sha)fail('RELEASE_PR_NOT_READY',409);
  safeBranch(pr.head.ref);
  if(pr.mergeable!==true||pr.mergeable_state!=='clean')fail('RELEASE_BRANCH_PROTECTION_OR_CONFLICT',409);
  const main=await current(repo,signal);
  if(exact(pr.base.sha)!==main)fail('RELEASE_BASE_MOVED',409);
  const raw=await api(repo,'/pulls/'+number+'/files?per_page=100','GET',undefined,signal);
  if(!Array.isArray(raw)||raw.length<1||raw.length>100||pr.changed_files!==raw.length)fail('RELEASE_DIFF_INCOMPLETE',409);
  const paths=(raw as unknown[]).map((f:unknown)=>{const row=obj(f);if(!['added','modified'].includes(row.status)||typeof row.filename!=='string'||!releasePathAllowed(repo,row.filename))fail('RELEASE_PATH_NOT_ALLOWED',403);return String(row.filename);});
  // A check is required from the fixed, already existing workflow(s), not an arbitrary green status.
  const required=repo===HAFIZE?['.github/workflows/quality.yml']:[...(paths.some(p=>p.startsWith('borsa-worker/'))?['.github/workflows/borsa-worker-live.yml']:[]),...(paths.some(p=>p.startsWith('borsa-gunlugu/'))?['.github/workflows/borsa-hosting-live.yml']:[])];
  const data=obj(await api(repo,'/actions/runs?head_sha='+sha+'&per_page=100','GET',undefined,signal));
  if(!Array.isArray(data.workflow_runs)||data.total_count!==data.workflow_runs.length)fail('RELEASE_CI_EVIDENCE_INCOMPLETE',409);
  const runs=(data.workflow_runs as unknown[]).map(obj).filter(r=>r.head_sha===sha);
  if(!required.every(path=>runs.some(r=>String(r.path).split('@')[0]===path&&r.status==='completed'&&r.conclusion==='success'))||runs.some(r=>r.status!=='completed'||!['success','skipped','neutral'].includes(r.conclusion)))fail('RELEASE_CI_NOT_GREEN',409);
  return {main,paths,required,runs:runs.map(r=>({id:r.id,name:r.name,conclusion:r.conclusion}))};
 }
 async function verifiedMainTests(repo:string,sha:string,workflow:string,signal?:AbortSignal){
  const data=obj(await api(repo,'/actions/runs?head_sha='+sha+'&per_page=100','GET',undefined,signal));
  if(!Array.isArray(data.workflow_runs)||data.total_count!==data.workflow_runs.length)fail('RELEASE_CI_EVIDENCE_INCOMPLETE',409);
  const expected=repo===HAFIZE?'.github/workflows/quality.yml':'.github/workflows/'+workflow;
  const matches=(data.workflow_runs as unknown[]).map(obj).filter(r=>r.head_sha===sha&&String(r.path).split('@')[0]===expected&&r.head_branch==='main');
  if(repo===HAFIZE){
   if(!matches.some(r=>r.status==='completed'&&r.conclusion==='success'))fail('RELEASE_MAIN_TESTS_NOT_GREEN',409);
   return;
  }
  for(const run of matches){
   if(!Number.isSafeInteger(run.id)||run.id<1)continue;
   const jobs=obj(await api(repo,'/actions/runs/'+run.id+'/jobs?per_page=100','GET',undefined,signal));
   if(!Array.isArray(jobs.jobs)||jobs.total_count!==jobs.jobs.length)continue;
   if(jobs.jobs.some((j:unknown)=>{const row=obj(j);return row.name==='test'&&row.head_sha===sha&&row.status==='completed'&&row.conclusion==='success';}))return;
  }
  fail('RELEASE_MAIN_TESTS_NOT_GREEN',409);
 }
 async function rollbackPlan(repo:string,sha:string,signal?:AbortSignal){
  if(await current(repo,signal)!==sha)fail('RELEASE_BASE_MOVED',409);
  const commit=obj(await api(repo,'/commits/'+sha,'GET',undefined,signal));
  if(exact(commit.sha)!==sha||!Array.isArray(commit.parents)||commit.parents.length!==1||!Array.isArray(commit.files)||commit.files.length<1||commit.files.length>30)fail('RELEASE_ROLLBACK_UNSUPPORTED',409);
  const parent=exact(commit.parents[0]?.sha);
  const files=(commit.files as unknown[]).map(f=>{const row=obj(f);if(row.status!=='modified'||typeof row.filename!=='string'||!releasePathAllowed(repo,row.filename))fail('RELEASE_ROLLBACK_UNSUPPORTED',409);return {path:String(row.filename),sha:exact(row.sha)};});
  const compare=obj(await api(repo,'/compare/'+parent+'...'+sha,'GET',undefined,signal));
  if(compare.total_commits!==1||!Array.isArray(compare.files)||compare.files.length!==files.length||!files.every(f=>compare.files.some((v:unknown)=>{const row=obj(v);return row.filename===f.path&&row.sha===f.sha&&row.status==='modified';})))fail('RELEASE_ROLLBACK_UNSUPPORTED',409);
  return {parent,files};
 }
 async function execute(raw:unknown,ctx:Context){
  const args=obj(raw),action=args.action,repo=typeof args.repository==='string'?args.repository.toLowerCase():'';
  if(!ctx.ownerAuthorized||!ctx.authorization?.repositories.includes(repo)||typeof action!=='string'||!ctx.authorization.actions.includes(action))fail('RELEASE_NOT_AUTHORIZED_FOR_TASK',403);
  if(!allowed.has(repo))fail('GITHUB_REPO_NOT_ALLOWED',403);
  const fields=action==='open'?['action','repository','branch','title','body']:action==='merge'?['action','repository','number','sha']:action==='publish'?['action','repository','sha','target']:action==='rollback_pr'?['action','repository','sha']:[];
  if(!fields.length||Object.keys(args).some(k=>!fields.includes(k)))fail('INVALID_GITHUB_ARGUMENTS');
  const assertActive=()=>{if(ctx.signal?.aborted)fail('RELEASE_CANCELLED',409);};
  assertActive();
  if(action==='open'){
   const branch=safeBranch(args.branch);
   const payload=writer.normalizeInput('pull',{repository:repo,head:branch,base:'main',title:text(args.title,240),body:typeof args.body==='string'?args.body:'',draft:false});
   assertActive();
   const ticket=writer.issueApproval('pull',payload,true);
   return writer.createPullRequest(ticket.ticket,payload);
  }
  const sha=exact(args.sha);
  if(action==='rollback_pr'){
   const plan=await rollbackPlan(repo,sha,ctx.signal);
   const branch='hafize/auto-rollback-'+randomUUID().replace(/-/g,'');
   const payloads=[];
   for(const file of plan.files){
    const path=file.path.split('/').map(encodeURIComponent).join('/');
    const old=obj(await api(repo,'/contents/'+path+'?ref='+plan.parent,'GET',undefined,ctx.signal));
    if(old.type!=='file'||old.encoding!=='base64'||typeof old.content!=='string'||!Number.isSafeInteger(old.size)||old.size<1||old.size>96*1024)fail('RELEASE_ROLLBACK_UNSUPPORTED',409);
    const bytes=Buffer.from(old.content.replace(/\s/g,''),'base64'),content=bytes.toString('utf8');
    if(bytes.length!==old.size||!Buffer.from(content,'utf8').equals(bytes)||content.includes('\0'))fail('RELEASE_ROLLBACK_UNSUPPORTED',409);
    payloads.push(writer.normalizeInput('file',{repository:repo,branch,path:file.path,content,message:'Restore previous source '+sha.slice(0,12),existingSha:file.sha}));
   }
   const branchPayload=writer.normalizeInput('branch',{repository:repo,branch,fromRef:sha});
   const pullPayload=writer.normalizeInput('pull',{repository:repo,head:branch,base:'main',draft:false,title:'Rollback '+sha.slice(0,12),body:'Restore parent '+plan.parent+' on separate branch. CI and normal merge controls remain required.'});
   assertActive();if(await current(repo,ctx.signal)!==sha)fail('RELEASE_BASE_MOVED',409);
   await writer.createBranch(writer.issueApproval('branch',branchPayload,true).ticket,branchPayload);
   for(const payload of payloads){assertActive();await writer.commitFile(writer.issueApproval('file',payload,true).ticket,payload);}
   assertActive();if(await current(repo,ctx.signal)!==sha)fail('RELEASE_BASE_MOVED',409);
   const pull=await writer.createPullRequest(writer.issueApproval('pull',pullPayload,true).ticket,pullPayload);
   return {action:'rollback_pr',repository:repo,branch,restoresParent:plan.parent,sourceSha:sha,pull,merged:false,published:false,note:'Rollback branch and PR only; verify tests before merge and exact live release.'};
  }
  if(action==='merge'){
   const number=id(args.number);
   const existing=await observedMerge(repo,number,sha,ctx.signal);
   if(existing)return existing;
   const before=await preflight(repo,number,sha,ctx.signal);
   assertActive();
   const after=await preflight(repo,number,sha,ctx.signal);
   if(after.main!==before.main||JSON.stringify(after.paths)!==JSON.stringify(before.paths))fail('RELEASE_BASE_MOVED',409);
   assertActive();
   try{
    const merged=obj(await api(repo,'/pulls/'+number+'/merge','PUT',{sha,merge_method:'squash'},ctx.signal));
    if(merged.merged!==true)fail('RELEASE_MERGE_NOT_CONFIRMED',409);
    return {action:'merge',repository:repo,number,headSha:sha,mergeCommitSha:exact(merged.sha),merged:true,published:false};
   }catch(error){
    // A cancelled task cannot launch additional work. Otherwise only inspect,
    // never send a second merge request, even after a transport failure.
    if(!ctx.signal?.aborted){
     try{const verified=await observedMerge(repo,number,sha,ctx.signal);if(verified)return {...verified,reconciled:true};}catch{/* preserve the original failure */}
    }
    throw error;
   }
  }
  const target=args.target??(repo===HAFIZE?'render':undefined);
  if(repo===HAFIZE&&target!==(ctx.authorization?.hafizePublishTarget??'render'))fail('RELEASE_TARGET_NOT_AUTHORIZED',403);
  if(repo===HAFIZE&&target==='render'){
   if(await current(repo,ctx.signal)!==sha)fail('RELEASE_BASE_MOVED',409);
   assertActive();
   await verifiedMainTests(repo,sha,'quality.yml',ctx.signal);
   if(await current(repo,ctx.signal)!==sha)fail('RELEASE_BASE_MOVED',409);
   assertActive();
   // Read the public fixed-origin release markers without any GitHub or Render credentials.
   try{
    const responses=await Promise.all(['/release.json','/api/health/live'].map(path=>renderFetch(RENDER_ORIGIN+path,{redirect:'error',cache:'no-store',signal:ctx.signal?AbortSignal.any([ctx.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)})));
    if(responses.every(r=>r.ok)){
     const [release,health]=await Promise.all(responses.map(r=>r.json()));
     if(release?.commit===sha&&health?.revision===sha&&health?.status==='ok')return {action:'publish',repository:repo,target:'render',requestedSha:sha,published:true,existing:true};
    }else await Promise.all(responses.map(r=>r.body?.cancel().catch(()=>{})));
   }catch{/* Public health is diagnostic, not an authorization or success signal. */}
   assertActive();
   if(otherActiveTasks())fail('RENDER_ACTIVE_TASKS',409);
   let hook:URL;
   try{hook=new URL(renderHook);}catch{return fail('RENDER_DEPLOY_HOOK_NOT_CONFIGURED',409);}
   if(hook.origin!=='https://api.render.com'||hook.pathname!=='/deploy/'+RENDER_SERVICE||hook.username||hook.password||hook.hash||!hook.searchParams.get('key')||[...hook.searchParams.keys()].some(k=>k!=='key')||hook.searchParams.getAll('key').length!==1)fail('RENDER_DEPLOY_HOOK_INVALID',409);
   hook.searchParams.set('ref',sha);
   if(await current(repo,ctx.signal)!==sha)fail('RELEASE_BASE_MOVED',409);
   assertActive();
   if(otherActiveTasks())fail('RENDER_ACTIVE_TASKS',409);
   // Atomically fence admission in the outgoing server before dispatch. The
   // trusted task callback is never a model parameter. Keep the fence for an
   // uncertain dispatch too: do not repeat or start another durable task.
   if(!ctx.reserveRender?.())fail('RENDER_DEPLOYMENT_PENDING',409);
   // Never return or log the hook URL; a transport failure may include it.
   let response:Response;
   try{response=await renderFetch(hook,{method:'POST',redirect:'error',signal:ctx.signal?AbortSignal.any([ctx.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});}catch{return fail('RENDER_DEPLOY_REQUEST_UNCERTAIN',502);}
   if(!response.ok){await response.body?.cancel().catch(()=>{});return fail('RENDER_DEPLOY_HTTP_FAILED',response.status);}
   if(![200,202].includes(response.status)){await response.body?.cancel().catch(()=>{});return fail('RENDER_DEPLOY_REQUEST_UNCERTAIN',502);}
   let deployId:string|undefined;
   if(response.status===200){try{const data=await response.json();if(typeof data?.deploy?.id==='string'&&/^dep-[a-z0-9]{8,80}$/.test(data.deploy.id))deployId=data.deploy.id;}catch{/* accepted, ID unavailable */}}else await response.body?.cancel().catch(()=>{});
   return {action:'publish',repository:repo,target:'render',requestedSha:sha,dispatchAccepted:true,published:false,...(deployId?{deployId}:{}),note:'Verify the exact Render release and live health after deployment. No automatic repeat.'};
  }
  const workflow=repo===HAFIZE&&target==='firebase'?'firebase-hosting-live.yml':repo===SITES&&target==='cloudflare'?'borsa-worker-live.yml':repo===SITES&&target==='firebase'?'borsa-hosting-live.yml':'';
  if(!workflow)fail('RELEASE_TARGET_NOT_SUPPORTED');
  if(await current(repo,ctx.signal)!==sha)fail('RELEASE_BASE_MOVED',409);
  assertActive();
  await verifiedMainTests(repo,sha,workflow,ctx.signal);
  if(await current(repo,ctx.signal)!==sha)fail('RELEASE_BASE_MOVED',409);
  assertActive();
  await api(repo,'/actions/workflows/'+workflow+'/dispatches','POST',{ref:'main',inputs:{expected_sha:sha}},ctx.signal);
  return {action:'publish',repository:repo,requestedSha:sha,workflow,dispatchAccepted:true,published:false,note:'Check exact workflow run and live release marker; dispatch is not deployment success.'};
 }
 return Object.freeze({enabled,execute});
}

/** Trusted user-message scope; never derived from a tool result, model argument, or repository text. */
export function releaseAuthorizationForRequest(request:unknown,optedIn:boolean):ReleaseAuthorization|undefined{
 if(!optedIn||typeof request!=='string'||request.length>12000)return;
 const s=request.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/ı/g,'i');
 // A prohibition on merge/publish must not hide an explicitly requested
 // PR-only action. Keep the conservative veto for all release mutations
 // except the narrowly requested PR creation, and respect PR negation too.
 if(/\b(?:sadece incele|yalnizca incele|salt okunur|sadece oku|yalnizca oku)\b/.test(s))return;
 const explicitOpen=/\b(?:pr|pull request)(?:'i|i)?\s+(?:ac|olustur)\b/.test(s);
 const denyOpen=/\b(?:pr|pull request)(?:'i|i)?\s+(?:acma|olusturma|acmayin|olusturmayin|acma(?:yi)?|olusturma(?:yi)?)\b/.test(s)||
   /\b(?:pr|pull request)\s+(?:ac|olustur)\s+ma\b/.test(s);
 if(denyOpen)return;
 // A positive noun phrase is not the negative imperative "birleştirme".
 // Remove only the complete affirmative phrase; any separate prohibition remains.
 const negativeScope=s.replace(/\bbirlestirme islemini gerceklestir\b/g,'');
 const denyRelease=/\b(?:merge etme|merge yapma|birlestirme|birlestirme yapma|yayinlama|canliya alma|canli yayin yapma|deploy etme|deploy yapma)\b/.test(negativeScope);
 const publish=!denyRelease&&/\b(?:canliya al|yayinla|deploy et|canliya yayinla)\b/.test(s);
 const merge=!denyRelease&&(publish||/\b(?:merge et|birlestir)\b/.test(s));
 const rollback=!denyRelease&&/\b(?:geri al|rollback|geri dondur)\b/.test(s)&&!/\b(?:geri alma|rollback yapma|geri dondurme)\b/.test(s);
 const open=rollback||merge||explicitOpen;
 if(!open)return;
 const projects=matchOwnerProjects(request);
 // Shared/ambiguous project names are not production authorization.
 const project=projects.length===1?projects[0]?.id:projects.length===0&&/\bhafize\b/.test(s)?'hafize':null;
 const repository=project==='hafize'?HAFIZE:project==='borsa'?SITES:null;
 if(!repository)return;
 return Object.freeze({repositories:Object.freeze([repository]),actions:Object.freeze([...(publish?['open','merge','publish']:merge?['open','merge']:['open']),...(rollback?['rollback_pr']:[])]),...(repository===HAFIZE&&publish?{hafizePublishTarget:/\b(?:firebase (?:giris|yonlendirme)|firebase hosting|target\s*"\s*:\s*"firebase")\b/.test(s)?'firebase' as const:'render' as const}:{})});
}

/** Exact, user-authored merge command. No repository or model output is parsed.
 * It supplies arguments, not authorization: the ordinary release tool and all
 * its current owner, repository, CI, branch and SHA checks still execute. */
export function parseExplicitMergeCommand(request:unknown):{action:'merge';repository:string;number:number;sha:string}|null{
 if(typeof request!=='string'||request.length>12000)return null;
 const matches=[...request.matchAll(/(?:^|\n)[ \t]*github_release aracını şu parametrelerle çalıştır:[ \t]*\r?\n\s*(\{[^{}]{1,4096}\})/gu)];
 if(matches.length!==1)return null;
 try{
  const v=JSON.parse(matches[0][1]);
  if(!v||Array.isArray(v)||Object.keys(v).length!==4||Object.keys(v).some(k=>!['action','repository','number','sha'].includes(k)))return null;
  if(v.action!=='merge'||![HAFIZE,SITES].includes(v.repository)||!Number.isSafeInteger(v.number)||v.number<1||typeof v.sha!=='string'||!SHA.test(v.sha))return null;
  return {action:'merge',repository:v.repository,number:v.number,sha:v.sha.toLowerCase()};
 }catch{return null;}
}

/** Strict standalone structured release requests. Explicit owner intent must
 * precede the JSON; quoted examples, extra actions, wrong targets and malformed
 * parameters are not executable commands. The server still checks authorization
 * for the entire original request and uses the normal journaled release tool. */
export function parseExplicitReleaseCommand(request:unknown){
 const merge=parseExplicitMergeCommand(request);
 if(merge)return merge;
 if(typeof request!=='string'||request.length>12000)return null;
 const match=request.match(/^([^\r\n]{1,240})\r?\n(?:[ \t]*\r?\n)*[ \t]*github_release aracını şu parametrelerle çalıştır:[ \t]*\r?\n\s*(\{[^{}]{1,4096}\})\s*$/u);
 if(!match)return null;
 const first=match[1].toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/ı/g,'i').trim();
 try{
  const v=JSON.parse(match[2]);
  if(!v||Array.isArray(v)||typeof v.repository!=='string'||![HAFIZE,SITES].includes(v.repository))return null;
  const repo=v.repository;
  const scope=releaseAuthorizationForRequest(match[1],true);
  if(!scope?.repositories.includes(repo)||!scope.actions.includes(v.action))return null;
  if(v.action==='open'){
   if(![repo+' deposunda pr ac.',repo+' deposunda yalnizca pr ac.',repo+' deposunda pr olustur.'].includes(first))return null;
   if(Object.keys(v).length!==5||Object.keys(v).some(k=>!['action','repository','branch','title','body'].includes(k)))return null;
   if(typeof v.branch!=='string'||!BRANCH.test(v.branch)||v.branch.includes('..')||v.branch.endsWith('.lock')||typeof v.title!=='string'||!v.title.trim()||v.title.length>240||typeof v.body!=='string')return null;
   return {action:'open' as const,repository:repo,branch:v.branch,title:v.title,body:v.body};
  }
  if(v.action==='publish'){
   if(first!==repo+' deposunu canliya al.')return null;
   if(Object.keys(v).length!==4||Object.keys(v).some(k=>!['action','repository','sha','target'].includes(k)))return null;
   if(typeof v.sha!=='string'||!SHA.test(v.sha)||!(repo===HAFIZE&&['render','firebase'].includes(v.target)||repo===SITES&&['firebase','cloudflare'].includes(v.target)))return null;
   return {action:'publish' as const,repository:repo,sha:v.sha.toLowerCase(),target:v.target};
  }
 }catch{return null;}
 return null;
}
