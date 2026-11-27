import type {Pending} from './agent-turn-checkpoints.ts';
import type {GitHubReceipt} from './github-run-evidence.ts';
const REPO=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH=/^hafize\/auto-[a-z0-9][a-z0-9._-]{0,100}$/;
const SHA=/^[a-f0-9]{40}$/i;
const SOURCE=/^[a-zA-Z0-9_.\/-]{1,400}\.(?:ts|tsx|js|jsx|mjs|cjs|py|html|css|md|json|svg|txt)$/i;
const safeBranch=(v:string)=>BRANCH.test(v)&&!v.includes('..')&&!v.endsWith('.lock');
const safePath=(v:string)=>SOURCE.test(v)&&!v.split('/').some(x=>!x||x.startsWith('.')||/(?:secret|credential|token|private[-_]?key|auth|permission|security)/i.test(x));
/** Positive, fresh, read-only reconciliation. Absence or mismatches never
 * settle a target. No write, no credentials in results, no source in prompts. */
export async function reconcilePendingGitHubMutations({pending,allowedRepositories,fetchImpl,publicFetch=globalThis.fetch,signal}:{pending:readonly Pending[];allowedRepositories:readonly string[];fetchImpl:typeof fetch;publicFetch?:typeof fetch;signal?:AbortSignal}){
 const allowed=new Set(allowedRepositories.map(r=>r.toLowerCase()));
 const settled:Pending[]=[],receipts:GitHubReceipt[]=[];
 for(const p of pending.slice(0,20)){
  if(signal?.aborted)break;
  const repo=p.repository.toLowerCase();
  if(!REPO.test(repo)||!allowed.has(repo))continue;
  const root='https://api.github.com/repos/'+repo;
  const get=async(path:string)=>{
   const response=await fetchImpl(root+path,{method:'GET',redirect:'error',cache:'no-store',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)});
   if(!response.ok){await response.body?.cancel().catch(()=>{});return null;}
   return response.json();
  };
  try{
   let line='';
   if(p.tool==='github_develop'&&p.operation==='branch'&&safeBranch(p.preparedBranch||p.branch)){
    const branch=p.preparedBranch||p.branch;
    if(p.branch&&p.branch!==branch)continue;
    const ref=await get('/git/ref/heads/'+branch.split('/').map(encodeURIComponent).join('/'));
    if(ref?.ref==='refs/heads/'+branch&&ref.object?.type==='commit'&&SHA.test(ref.object?.sha??''))line=repo+' — '+branch+' dalı '+ref.object.sha+' commitinde mevcut; yeni dal açılmadı, oluşturan kimlik belirlenmedi.';
   }else if(p.tool==='github_develop'&&p.operation==='file'&&safeBranch(p.branch)&&safePath(p.path)&&p.expectedBlob&&SHA.test(p.expectedBlob)){
    // Resolve immutable branch head first; read only metadata of the exact
    // file at that commit. Content is never returned or logged.
    const ref=await get('/git/ref/heads/'+p.branch.split('/').map(encodeURIComponent).join('/'));
    if(ref?.ref!=='refs/heads/'+p.branch||ref.object?.type!=='commit'||!SHA.test(ref.object?.sha??''))continue;
    const head=ref.object.sha;
    const file=await get('/contents/'+p.path.split('/').map(encodeURIComponent).join('/')+'?ref='+head);
    if(file?.type==='file'&&file.path===p.path&&file.sha===p.expectedBlob)line=repo+' — '+p.path+' beklenen blob '+p.expectedBlob+' ile dalın '+head+' commitinde doğrulandı. Önceki yazmanın kim tarafından yapıldığı belirlenmedi; yeni commit oluşturulmadı.';
   }else if((p.tool==='github_develop'&&p.operation==='pull'||p.tool==='github_release'&&p.operation==='open')&&safeBranch(p.branch)){
    const owner=repo.split('/')[0];
    const prs=await get('/pulls?state=open&base=main&head='+encodeURIComponent(owner+':'+p.branch)+'&per_page=100');
    if(Array.isArray(prs)&&prs.length===1){
     const pr=prs[0];
     if(pr.state==='open'&&pr.head?.ref===p.branch&&pr.head?.repo?.full_name?.toLowerCase()===repo&&pr.base?.ref==='main'&&pr.base?.repo?.full_name?.toLowerCase()===repo&&Number.isSafeInteger(pr.number)&&pr.number>0)line=repo+' — [PR #'+pr.number+'](https://github.com/'+repo+'/pull/'+pr.number+') mevcut açık PR olarak doğrulandı; yeni PR açılmadı.';
    }
   }else if(p.tool==='github_release'&&p.operation==='merge'&&p.number&&Number.isSafeInteger(p.number)&&p.number>0&&SHA.test(p.sha)){
    const pr=await get('/pulls/'+p.number);
    if(pr?.number===p.number&&pr.state==='closed'&&pr.merged===true&&pr.head?.sha===p.sha&&safeBranch(pr.head?.ref??'')&&pr.head?.repo?.full_name?.toLowerCase()===repo&&pr.base?.ref==='main'&&pr.base?.repo?.full_name?.toLowerCase()===repo&&SHA.test(pr.merge_commit_sha??''))line=repo+' — PR #'+p.number+' zaten birleştirilmiş; '+pr.merge_commit_sha+' doğrulandı. Yeni merge yapılmadı.';
   }
   if(!line&&p.tool==='github_release'&&p.operation==='publish'&&p.target==='render'&&repo==='umitalgan061-sudo/hafize'&&SHA.test(p.sha)){
    const publicSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000);
    const responses=await Promise.all(['/release.json','/api/health/live'].map(path=>publicFetch('https://hafize-free.onrender.com'+path,{method:'GET',redirect:'error',cache:'no-store',signal:publicSignal})));
    if(responses.every(r=>r.ok)){
     const [release,health]=await Promise.all(responses.map(r=>r.json()));
     if(release?.commit===p.sha&&health?.revision===p.sha&&health?.status==='ok')line=repo+' — Render üzerinde '+p.sha+' canlı ve sağlıklı olarak doğrulandı. Yeni yayın isteği gönderilmedi.';
    }else await Promise.all(responses.map(r=>r.body?.cancel().catch(()=>{})));
   }
   if(line){settled.push(p);receipts.push({tool:'github_inspect',kind:'read',line});}
  }catch{/* Remain uncertain on transport, malformed or partial evidence. */}
 }
 return {settled,receipts};
}

// A recovery capsule is evidence only. Choose at most one repository from
// trusted checkpoint metadata and inspect the explicitly requested branch.
// This probe is not a pending mutation and cannot settle a journal entry.
export function recoveryBranchProbe({branch,receipts,pending,allowedRepositories}:{branch:string|null;receipts:readonly GitHubReceipt[];pending:readonly Pending[];allowedRepositories:readonly string[]}):Pending|null{
 if(!branch||!safeBranch(branch))return null;
 const repos=new Set([...receipts.map(r=>r.repository),...pending.map(p=>p.repository)].filter((r):r is string=>typeof r==='string'&&REPO.test(r)).map(r=>r.toLowerCase()));
 if(repos.size!==1)return null;
 const repository=[...repos][0]!;
 if(!allowedRepositories.some(r=>r.toLowerCase()===repository))return null;
 return {tool:'github_develop',operation:'branch',repository,branch,path:'',sha:'',number:null};
}
