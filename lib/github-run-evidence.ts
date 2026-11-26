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
export function githubWorkRequested(request:unknown,previous:readonly unknown[]=[]):boolean{
 const current=normal(request);
 const continuation=/\b(?:devam et|kaldigin yerden|tamamla|durma|tum islemleri|butun islemleri)\b/.test(current);
 const text=current+(continuation?' '+previous.slice(-6).map(normal).join(' '):'');
 return /\b(?:github|retake|hafize|depo|repo|pull request|commit|pr|firebase|nvidia)\b/.test(text)&&
 /\b(?:gelistir|duzelt|guncelle|uygula|olustur|entegre et|kodla|kod degisikligi|degistir|yayinla|canliya al|birlestir|merge|deploy|commit|tamamla|devam et|fix|implement|update|patch|write|create)\w*/.test(text);
}
export type GitHubReceipt={readonly tool:string;readonly line:string;readonly kind:'read'|'branch'|'file'|'pull'|'merge'|'dispatch'|'checks'|'error'};
/** Only an explicit file edit + commit on a named feature branch, with a
 * successful source read and no attempted mutation, qualifies for one retry.
 * This is a model reminder, not authorization or an automatic write. */
export function shouldRecoverReadOnlyWrite(request:unknown,receipts:readonly GitHubReceipt[],calls:readonly {name:string;ok?:boolean}[]):boolean{
 const s=normal(request);
 if(!/\bhafize\/auto-[a-z0-9][a-z0-9._-]{0,100}\b/.test(s)||!githubWorkRequested(request))return false;
 if(!/\b(?:dosya\w*|file|[a-z0-9_-]+\.(?:ts|js|css|html|md))\b/.test(s)||
    !/\b(?:duzenle|guncelle|degistir|duzelt|edit|update|patch)\b/.test(s)||
    !/\b(?:commit et|commit yap|commit olustur|commit the change)\b/.test(s))return false;
 if(/\b(?:commit etme|commit yapma|commit olusturma|dosya\w* (?:degistirme|duzenleme|guncelleme)|sadece oku|yalnizca oku|sadece incele|salt okunur|read only|do not commit)\b/.test(s))return false;
 return receipts.some(r=>r.tool==='github_read_file'&&r.kind==='read')&&
   !receipts.some(r=>r.kind==='error'||['file','pull','merge','dispatch'].includes(r.kind))&&
   !calls.some(c=>c.name==='github_develop'||c.name==='github_release');
}
export function githubReceipt(tool:string,result:unknown):GitHubReceipt[]{
 if(!['github_read_file','github_inspect','github_develop','github_release'].includes(tool))return [];
 const outer=rec(result),v=rec(outer.value);
 const item=(kind:GitHubReceipt['kind'],line:string):GitHubReceipt=>({tool,kind,line});
 if(outer.ok!==true)return [item('error',tool+': '+(token(outer.error,CODE)||'TOOL_FAILED')+(typeof outer.status==='number'?' (HTTP '+outer.status+')':''))];
 const repo=token(v.repository,REPO);
 if(!repo)return [item('error',tool+': doğrulanabilir depo bilgisi yok')];
 const root='https://github.com/'+repo;
 const sha=(value:unknown)=>token(value,SHA);
 const branch=token(v.branch,PATH);
 const path=token(v.path,PATH);
 const link=(label:string,url:string)=>'['+label+']('+url+')';
 if(tool==='github_develop'||tool==='github_release'){
  if(v.action==='branch'&&branch&&sha(v.fromSha))return [item('branch',repo+' — '+link(branch,root+'/tree/'+encodeURIComponent(branch))+' oluşturuldu; kaynak '+sha(v.fromSha)+'. Dal açmak kod değişikliği değildir.')];
  if(v.action==='file'&&v.verified===true&&branch&&path&&sha(v.commitSha)&&sha(v.blobSha))return [item('file',repo+' — '+path+'; '+link('commit '+sha(v.commitSha),root+'/commit/'+sha(v.commitSha))+'; blob '+sha(v.blobSha)+' (GitHub üzerinden tekrar okundu).')];
  if((v.action==='pull'||v.action==='open')&&positive(v.number))return [item('pull',repo+' — '+link('PR #'+v.number,root+'/pull/'+v.number)+(v.draft===true?' taslak':'')+(v.existing===true?' mevcut PR doğrulandı.':' açıldı.'))];
  if(v.action==='merge'&&v.merged===true&&positive(v.number)&&sha(v.mergeCommitSha))return [item('merge',repo+' — '+link('PR #'+v.number,root+'/pull/'+v.number)+(v.existing===true?' daha önce birleştirilmiş; GitHub üzerinden doğrulandı; ':' birleştirildi; ')+link(sha(v.mergeCommitSha),root+'/commit/'+sha(v.mergeCommitSha))+'.')];
  if(v.action==='publish'&&v.target==='render'&&v.published===true&&v.existing===true&&sha(v.requestedSha))return [item('read',repo+' — Render uygulaması zaten bu SHA ile canlı: '+sha(v.requestedSha)+'. Yeni yayın isteği gönderilmedi.')];
  if(v.action==='publish'&&v.dispatchAccepted===true&&sha(v.requestedSha))return [item('dispatch',repo+' — '+sha(v.requestedSha)+(v.target==='render'?' için Render':' için')+' yayın isteği kabul edildi. Canlı yayın doğrulanmadı.')];
  return [item('error',repo+' — '+tool+' yanıtı tamamlanmış yazma kanıtı değil.')];
 }
 if(tool==='github_read_file'&&path&&sha(v.sha))return [item('read',repo+' — '+path+' blob '+sha(v.sha)+(v.truncated===true?' (kısmi okuma).':' okundu.'))];
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
