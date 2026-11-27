/**
 * Deterministic GitHub operation receipts. Only trusted runtime tool results
 * enter this formatter. Model prose, prompt text and repository file contents
 * can never supply a receipt or turn a read into a write.
 */
const REPO=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA=/^[a-f0-9]{40}$/i;
const PATH=/^[A-Za-z0-9_.\/-]{1,400}$/;
const CODE=/^[A-Z0-9_]{1,100}$/;
const rec=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const token=(value:unknown,pattern:RegExp)=>typeof value==='string'&&pattern.test(value)?value:'';
const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
const normal=(value:unknown)=>typeof value==='string'?value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/ı/g,'i'):'';
/** Match only short, scope-free follow-ups. Do not treat arbitrary mentions
 * of "continue" in unrelated questions as continuation of an old repo task. */
export function bareDevelopmentContinuation(value:unknown):boolean{
 let s=normal(value).trim().replace(/[.!\s]+$/g,'').replace(/\s+/g,' ');
 // A quality preference is not a new project or release authorization.
 // Strip only this exact scope-free prefix, never arbitrary comparative text.
 s=s.replace(/^artik claude['’]dan daha iyi gelistirme yapmani istiyorum[.!]\s+/, '');
 if(/^(?:kaldigin yerden devam et|devam et|tamamla|continue|resume|gelistirmeye devam et|(?:gerekli |tum |butun )?gelistirmeleri (?:kapsamli sekilde )?yap)(?: lutfen)?$/.test(s))return true;
 return /^(?:kaldigin yerden devam et|devam et|gelistirmeye devam et)[,.!]\s*(?:gerekli |tum |butun )?gelistirmeleri (?:kapsamli sekilde )?yap(?: lutfen)?$/.test(s);
}
function substantivePrior(previous:readonly unknown[]):unknown{
 for(const prior of previous.slice(-32).reverse()){
  if(bareDevelopmentContinuation(prior))continue;
  return prior;
 }
 return undefined;
}
export function githubWorkRequested(request:unknown,previous:readonly unknown[]=[]):boolean{
 const current=normal(request);
 const text=bareDevelopmentContinuation(request)?current+' '+normal(substantivePrior(previous)):current;
 return /\b(?:github|retake|hafize|depo|repo|pull request|commit|pr|firebase|nvidia)\b/.test(text)&&
 /\b(?:gelistir|duzelt|guncelle|uygula|olustur|entegre et|kodla|kod degisikligi|degistir|yayinla|canliya al|birlestir|merge|deploy|commit|pr ac|pull request ac|tamamla|devam et|fix|implement|update|patch|write|create)\w*/.test(text);
}
export type GitHubReceipt={readonly tool:string;readonly line:string;readonly kind:'read'|'branch'|'file'|'pull'|'merge'|'dispatch'|'checks'|'error';readonly repository?:string;readonly branch?:string;readonly preWriteRejected?:true};
/** Only a single explicit feature branch named in the latest user request.
 * It is a restriction, never an authorization. Ambiguous branch requests
 * keep the existing tool constraints. */
export function requestedExistingFeatureBranch(request:unknown):string|null{
 if(typeof request!=='string')return null;
 const s=normal(request);
 const matches=[...new Set(s.match(/\bhafize\/auto-[a-z0-9][a-z0-9._-]{0,100}\b/g)??[])];
 if(matches.length!==1||matches[0].includes('..')||matches[0].endsWith('.lock'))return null;
 if(!s.includes(matches[0])||!/\b(?:dalinda|dalini (?:kullan|kontrol et|koru|duzenle)|dalindan devam et|mevcut dal|ayni dal)\b/.test(s))return null;
 if(/\b(?:yeni (?:bir )?dal (?:ac|olustur)|yeni (?:bir )?gelistirme dali (?:ac|olustur))\b/.test(s))return null;
 return matches[0];
}
/** Inherit only the immediately preceding substantive user request for
 * an otherwise bare continuation. Never extract authority from assistant
 * output, repository content or a new unrelated task. */
export function continuationDevelopmentRequest(request:unknown,previous:readonly unknown[]=[]):unknown{
 if(!bareDevelopmentContinuation(request))return request;
 const prior=substantivePrior(previous);
 return requestedExistingFeatureBranch(prior)&&githubWorkRequested(prior)?prior:request;
}
export function violatesExistingFeatureBranch(branch:string|null,tool:string,args:unknown):boolean{
 if(!branch||!['github_develop','github_release'].includes(tool))return false;
 let v:Record<string,unknown>;
 try{v=rec(typeof args==='string'?JSON.parse(args):args);}catch{return false;}
 if(tool==='github_develop')return v.operation==='branch'||(['file','pull'].includes(String(v.operation))&&v.branch!==branch);
 return v.action==='open'&&v.branch!==branch;
}
/** A newly created feature branch is trusted only from current tool receipts.
 * This narrows recovery to the single repository read and branch created here;
 * never derives a target from model prose or grants additional permissions. */
export function verifiedCreatedFeatureBranch(receipts:readonly GitHubReceipt[]):{repository:string;branch:string}|null{
 const rows=receipts.filter(r=>r.tool==='github_develop'&&r.kind==='branch');
 const unique=[...new Map(rows.map(r=>[r.repository+'|'+r.branch,r])).values()];
 if(unique.length!==1)return null;
 const row=unique[0];
 if(!row.repository||!REPO.test(row.repository)||!row.branch||!/^hafize\/auto-[a-z0-9][a-z0-9._-]{0,100}$/.test(row.branch)||row.branch.includes('..')||row.branch.endsWith('.lock'))return null;
 if(!receipts.some(r=>r.kind==='read'&&r.tool==='github_read_file'&&r.repository===row.repository))return null;
 if(receipts.some(r=>r.repository&&r.repository!==row.repository))return null;
 return {repository:row.repository,branch:row.branch};
}
/** A named branch is a user restriction, not evidence it exists.
 * Derive a repository hint only from successful file reads, never prose.
 * The writer still must verify the same branch and current blob itself. */
export function namedReadTarget(request:unknown,receipts:readonly GitHubReceipt[]):{repository:string;branch:string}|null{
 const branch=requestedExistingFeatureBranch(request);
 if(!branch)return null;
 const reads=receipts.filter(r=>r.kind==='read'&&r.tool==='github_read_file');
 const repositories=[...new Set(reads.map(r=>r.repository).filter((r):r is string=>Boolean(r&&REPO.test(r))))];
 if(repositories.length!==1||receipts.some(r=>r.repository&&r.repository!==repositories[0]))return null;
 return {repository:repositories[0]!,branch};
}
/** A completed recovery statement is history, not a new read-only command.
 * Strip only the exact leading transition to a new instruction, solely for
 * restriction matching. All actual restrictions and runtime fences remain.
 */
function currentDirectiveForRestrictions(s:string):string{
 return s.replace(/^(?:hafize\s*,\s*)?salt okunur kurtarma turunu tamamladin[.!]\s+simdi\s+/, '');
}
/** Only deterministic read-only call rejections are recoverable here.
 * A malformed inspection cannot mutate GitHub. Retain its error receipt,
 * but do not let it prevent bounded model repair after successful reads.
 * Never exempt permission, transport, not-found or write failures. */
function recoverableReadReceipt(row:GitHubReceipt):boolean{
 if(row.kind!=='error')return false;
 if((row.tool==='github_inspect'||row.tool==='github_read_file')&&row.line===row.tool+': REPEATED_TOOL_CALL')return true;
 return row.tool==='github_inspect'&&row.line==='github_inspect: INVALID_GITHUB_ARGUMENTS (HTTP 400)';
}
/** Bounded model recovery after inspection, with no attempted file, PR,
 * merge or publish mutation. A verified branch creation is not delivery.
 * Never replay a mutation, override permission, or choose code automatically. */
export function shouldRecoverReadOnlyWrite(request:unknown,receipts:readonly GitHubReceipt[],calls:readonly {name:string;ok?:boolean;operation?:string;error?:string|null;reason?:string|null;status?:number|null}[]):boolean{
 const s=normal(request);
 const named=requestedExistingFeatureBranch(request),created=verifiedCreatedFeatureBranch(receipts);
 if((!named&&!created)||!githubWorkRequested(request))return false;
 if(named&&created&&named!==created.branch)return false;
 const explicitEdit=/\b(?:dosya\w*|file|[a-z0-9_-]+\.(?:ts|js|css|html|md|py))\b/.test(s)&&/\b(?:duzenle|guncelle|degistir|duzelt|gelistir|iyilestir|edit|update|patch|improve)\b/.test(s)&&/\b(?:commit et|commit yap|commit olustur|commit the change)\b/.test(s);
 const development=/\b(?:gelistir|iyilestir|algoritma iyilestirmeleri yap|gelistirmeleri tamamla|kod degisikligi yap)\b/.test(s)&&/\b(?:pr olustur|pr ac|test\w* ekle|regresyon test\w*|kod degisikligi|algoritma)\b/.test(s);
 const newBranchDevelopment=Boolean(created)&&/\b(?:tasarla|gelistir|iyilestir|duzenle|guncelle|degistir|uygula|kod degisiklik\w*|implement|update|patch)\w*/.test(s)&&/\b(?:commit|pr ac|pr olustur|merge|canliya al|kod degisiklik\w*)\b/.test(s);
 if(!explicitEdit&&!development&&!newBranchDevelopment)return false;
 if(/\b(?:commit etme|commit yapma|commit olusturma|dosya\w* (?:degistirme|duzenleme|guncelleme)|sadece oku|yalnizca oku|sadece incele|yalnizca incele|salt okunur|read only|do not commit|degisiklik yapma|kod yazma)\b/.test(currentDirectiveForRestrictions(s)))return false;
 return receipts.some(r=>r.tool==='github_read_file'&&r.kind==='read')&&
   !receipts.some(r=>(r.kind==='error'&&!recoverableReadReceipt(r)&&!r.line.includes('GITHUB_REQUESTED_BRANCH_MISMATCH')&&!(r.tool==='github_develop'&&r.preWriteRejected===true))||['file','pull','merge','dispatch'].includes(r.kind))&&
   !calls.some(c=>c.name==='github_release'||(c.name==='github_develop'&&!(c.operation==='branch'&&c.ok===true)&&c.error!=='GITHUB_REQUESTED_BRANCH_MISMATCH'&&!(c.operation==='file'&&c.ok===false&&c.error==='INVALID_GITHUB_ARGUMENTS'&&c.status===400&&c.reason==='GITHUB_ARGS_FILE_PRE_WRITE')));
}
/** Exact-file proposal may retry a failed exploratory read, but must fetch
 * the owner-named file from the verified target branch again before writing.
 * This does not waive a 404 or directory read for normal model-driven writes, or any mutation,
 * authorization or transport failure. */
export function explicitPatchRecoveryTarget(request:unknown,receipts:readonly GitHubReceipt[],calls:readonly {name:string;ok?:boolean;operation?:string;error?:string|null;reason?:string|null;status?:number|null}[]):{repository:string;branch:string}|null{
 const target=verifiedCreatedFeatureBranch(receipts)??namedReadTarget(request,receipts);
 if(!target)return null;
 const safeReceipts=receipts.filter(r=>!(r.tool==='github_read_file'&&r.kind==='error'&&['github_read_file: GITHUB_READ_FAILED (HTTP 404)','github_read_file: GITHUB_PATH_NOT_FILE (HTTP 400)'].includes(r.line)));
 // A successful read is still required. The normal write recovery policy
 // supplies the affirmative commit intent and all mutation vetoes.
 return shouldRecoverReadOnlyWrite(request,safeReceipts,calls)?target:null;
}
/** Only explicit affirmative PR requests on a named existing feature
 * branch. A verified file write is progress, not delivery of the PR.
 * No retry after a PR mutation attempt or a failed/uncertain write. */
export function explicitPullRequested(request:unknown):boolean{
 const s=normal(request);
 return Boolean(requestedExistingFeatureBranch(request))&&/\b(?:pr|pull request)\s+(?:olustur|ac|hazirla)\b/.test(s)&&!/\b(?:pr|pull request)\s+(?:olusturma|acma|hazirlama|istemiyorum)\b|\b(?:sadece oku|yalnizca oku|sadece incele|yalnizca incele|salt okunur|degisiklik yapma|kod yazma|do not open)\b/.test(currentDirectiveForRestrictions(s));
}
export function shouldRecoverMissingPull(request:unknown,receipts:readonly GitHubReceipt[],calls:readonly {name:string;ok?:boolean;operation?:string}[]):boolean{
 const created=verifiedCreatedFeatureBranch(receipts);
 const s=normal(request);
 const newBranchPull=Boolean(created)&&githubWorkRequested(request)&&/\b(?:pr|pull request)\s+(?:olustur|ac|hazirla)\b/.test(s)&&!/\b(?:pr|pull request)\s+(?:olusturma|acma|hazirlama|istemiyorum)\b|\b(?:sadece oku|yalnizca oku|sadece incele|yalnizca incele|salt okunur|degisiklik yapma|kod yazma|do not open)\b/.test(currentDirectiveForRestrictions(s))&&receipts.some(r=>r.kind==='file'&&r.repository===created?.repository&&r.branch===created?.branch);
 return (explicitPullRequested(request)||newBranchPull)&&receipts.some(r=>r.kind==='file')&&!receipts.some(r=>['pull','merge','dispatch'].includes(r.kind)||(r.kind==='error'&&!recoverableReadReceipt(r)))&&!calls.some(c=>c.name==='github_release'||(c.name==='github_develop'&&(c.operation==='pull'||c.ok!==true)));
}
export function githubReceipt(tool:string,result:unknown):GitHubReceipt[]{
 if(!['github_read_file','github_inspect','github_develop','github_release'].includes(tool))return [];
 const outer=rec(result),v=rec(outer.value);
 const item=(kind:GitHubReceipt['kind'],line:string,scope?:{repository:string;branch?:string}):GitHubReceipt=>({tool,kind,line,...scope});
 if(outer.ok!==true){
  const hints:Record<string,string>={
   GITHUB_ARGS_BRANCH:'Dal parametreleri: operation, repository ve isteğe bağlı branch.',
   GITHUB_ARGS_FILE:'Dosya parametreleri: branch/path/message ve content veya find/replace/existingSha.',
   GITHUB_ARGS_FILE_PRE_WRITE:'Yerel dosya parametre doğrulaması yazma başlamadan reddetti. Düzeltilmiş çağrı için yalnız bir yazma biçimi kullan.' ,
   GITHUB_ARGS_PULL:'PR parametreleri: branch/title ve isteğe bağlı body.',
   GITHUB_ARGS_OPERATION:'operation: branch, file veya pull.'
  };
  const errors:Record<string,string>={
   GITHUB_REQUESTED_BRANCH_MISMATCH:'Kullanıcının belirttiği mevcut dalı kullan.',
   GITHUB_PR_PREFLIGHT_FAILED:'Mevcut PR durumu doğrulanamadı; yeni PR isteği gönderilmedi.',
   GITHUB_PR_VERIFICATION_FAILED:'PR yazma sonucu doğrulanamadı; aynı isteği tekrar göndermeden mevcut dalı kontrol et.',
   GITHUB_HEAD_MOVED:'Dalın son durumunu ve blob SHA değerini yeniden oku; önceki yazmayı kontrol et.',
   RELEASE_BRANCH_MISMATCH:'PR, kullanıcının belirttiği geliştirme dalına ait değil; birleştirme yapılmadı.',
   RELEASE_PR_NOT_READY:'PR durumunu doğrula; taslak PR birleştirilemez. Yeni bir kopya açma.',
   RELEASE_BASE_MOVED:'Güncel main SHA değerini yeniden doğrula.',
   RELEASE_WORKFLOW_DISPATCH_FORBIDDEN:'GitHub Actions yayın izni reddedildi.',
   RENDER_ACTIVE_TASKS:'Başka bir GitHub görevi devam ederken Render yayını başlatılmadı.',
   RENDER_DEPLOYMENT_PENDING:'Yayın için mevcut görev kapısı rezerve edilmiş veya aktif görev doğrulanamamış; tekrar yayın göndermeden durumu doğrula.',
   RENDER_DEPLOY_HOOK_NOT_CONFIGURED:'Render servisine özel yayın bağlantısı yapılandırılmamış.',
   RELEASE_TARGET_NOT_AUTHORIZED:'Firebase yönlendirme yayını açıkça istenmedikçe Render hedefini kullan.'
  };
  const code=token(outer.error,CODE)||'TOOL_FAILED';
  const hint=tool==='github_develop'&&code==='INVALID_GITHUB_ARGUMENTS'?hints[token(outer.reason,CODE)]:errors[code];
  const errorReceipt=item('error',tool+': '+code+(typeof outer.status==='number'?' (HTTP '+outer.status+')':'')+(hint?' — '+hint:''));
  return [tool==='github_develop'&&code==='INVALID_GITHUB_ARGUMENTS'&&outer.status===400&&outer.reason==='GITHUB_ARGS_FILE_PRE_WRITE'?{...errorReceipt,preWriteRejected:true}:errorReceipt];
 }
 const repo=token(v.repository,REPO);
 if(!repo)return [item('error',tool+': doğrulanabilir depo bilgisi yok')];
 const root='https://github.com/'+repo;
 const sha=(value:unknown)=>token(value,SHA);
 const branch=token(v.branch,PATH);
 const path=token(v.path,PATH);
 const link=(label:string,url:string)=>'['+label+']('+url+')';
 if(tool==='github_develop'||tool==='github_release'){
  if(v.action==='branch'&&branch&&sha(v.fromSha))return [item('branch',repo+' — '+link(branch,root+'/tree/'+encodeURIComponent(branch))+' oluşturuldu; kaynak '+sha(v.fromSha)+'. Dal açmak kod değişikliği değildir.',{repository:repo,branch})];
  if(v.action==='file'&&v.verified===true&&branch&&path&&sha(v.commitSha)&&sha(v.blobSha))return [item('file',repo+' — '+path+'; '+link('commit '+sha(v.commitSha),root+'/commit/'+sha(v.commitSha))+'; blob '+sha(v.blobSha)+' (GitHub üzerinden tekrar okundu).',{repository:repo,branch})];
  if((v.action==='pull'||v.action==='open')&&positive(v.number))return [item('pull',repo+' — '+link('PR #'+v.number,root+'/pull/'+v.number)+(v.draft===true?' taslak (birleştirilemez; incelemeye hazır olmalı)':'')+(v.existing===true?' mevcut PR doğrulandı; yeni PR açılmadı.':' açıldı.'))];
  if(v.action==='merge'&&v.merged===true&&positive(v.number)&&sha(v.mergeCommitSha))return [item('merge',repo+' — '+link('PR #'+v.number,root+'/pull/'+v.number)+(v.existing===true?' daha önce birleştirilmiş; GitHub üzerinden doğrulandı; ':' birleştirildi; ')+link(sha(v.mergeCommitSha),root+'/commit/'+sha(v.mergeCommitSha))+'.')];
  if(v.action==='publish'&&v.target==='render'&&v.published===true&&v.existing===true&&sha(v.requestedSha))return [item('read',repo+' — Render uygulaması zaten bu SHA ile canlı: '+sha(v.requestedSha)+'. Yeni yayın isteği gönderilmedi.')];
  if(v.action==='publish'&&v.dispatchAccepted===true&&sha(v.requestedSha))return [item('dispatch',repo+' — '+sha(v.requestedSha)+(v.target==='render'?' için Render':' için')+' yayın isteği kabul edildi.'+(v.target==='render'&&typeof v.deployId==='string'&&/^dep-[a-z0-9]{8,80}$/.test(v.deployId)?' Dağıtım '+v.deployId+'.':'')+' Canlı yayın doğrulanmadı.')];
  return [item('error',repo+' — '+tool+' yanıtı tamamlanmış yazma kanıtı değil.')];
 }
 if(tool==='github_read_file'&&path&&sha(v.sha))return [item('read',repo+' — '+path+' blob '+sha(v.sha)+(v.truncated===true?' (kısmi okuma).':' okundu.'),{repository:repo})];
 if(tool==='github_inspect'&&Array.isArray(v.runs)&&sha(v.sha)){
  const rows=v.runs.slice(0,12).flatMap(raw=>{const run=rec(raw);if(sha(run.headSha)!==sha(v.sha)||!positive(run.id))return [];
   const status=token(run.status,/^[a-z_]{1,40}$/)||'unknown';
   const conclusion=token(run.conclusion,/^[a-z_]{1,40}$/)||'pending';
   return [item('checks',repo+' — '+link('CI #'+run.id,root+'/actions/runs/'+run.id)+': '+status+' / '+conclusion+'; SHA '+sha(v.sha)+'.')];});
  return rows.length?rows:[item('checks',repo+' — '+sha(v.sha)+' için CI sonucu bulunamadı.')];
 }
 return [item('read',repo+' — salt okunur inceleme gerçekleşti; bu işlem değişiklik veya yayın değildir.')];
}
export function formatGitHubRunEvidence(receipts:readonly GitHubReceipt[]):string{
 const distinct=[...new Map(receipts.map(row=>[row.kind+'|'+row.line,row])).values()];
 const writes=distinct.filter(row=>['file','pull','merge','dispatch'].includes(row.kind));
 const lines=['**GitHub çalışma raporu — yalnızca araç kanıtları**'];
 if(!writes.length)lines.push('Bu turda doğrulanmış dosya değişikliği, PR, birleştirme veya yayın isteği yok.');
 if(distinct.length)lines.push(...distinct.slice(-30).map(row=>'- '+row.line));
 if(!distinct.length)lines.push('Bu turda GitHub aracından doğrulanmış sonuç alınmadı.');
 lines.push('Rapor yalnız gözlenen işlemleri kapsar. İstenen tüm özelliklerin tamamlandığı, tüm testlerin geçtiği veya canlı sürümün güncellendiği ayrıca doğrulanmadan söylenemez.');
 return lines.join('\n\n');
}

/** A ready PR route is guidance only. It cannot add tools or authority.
 * Preserve draft-only behavior if release/open/merge is not authorized. */
export function pullDeliveryInstruction(authorization:{repositories:readonly string[];actions:readonly string[]}|undefined,advertisedTools:readonly string[],repository?:string):string{
 const ready=advertisedTools.includes('github_release')&&authorization?.actions.includes('open')&&authorization.actions.includes('merge')&&authorization.repositories.length===1&&(!repository||authorization.repositories[0]===repository.toLowerCase());
 if(ready)return 'Birleştirme açıkça yetkili: gerekli tüm kod değişiklikleri ve testler tamamlandıktan sonra github_release action=open ile aynı dalda incelemeye hazır PR aç veya mevcut PR durumunu doğrula. github_develop operation=pull yalnız taslak oluşturur ve merge edilemez. Mevcut taslak PR varsa tekrar PR açma; incelemeye hazır duruma geçmesi gerektiğini açıkça bildir. Kesin PR head SHA ve gerçek CI ile ilerle.';
 return 'Yalnız izinli PR işlemini kullan. github_develop operation=pull taslak PR oluşturur; merge/yayın yetkisi yoksa bunları başlatma. Mevcut PR varsa tekrar oluşturma.';
}
