import { describe, expect, it } from 'vitest';
import { githubWorkRequested, githubReceipt, formatGitHubRunEvidence, shouldRecoverReadOnlyWrite, requestedExistingFeatureBranch, violatesExistingFeatureBranch, continuationDevelopmentRequest, explicitPullRequested, shouldRecoverMissingPull, verifiedCreatedFeatureBranch, bareDevelopmentContinuation } from './github-run-evidence.ts';
const repository='umitalgan061-sudo/retake', commit='a'.repeat(40), blob='b'.repeat(40);
describe('GitHub run evidence',()=>{
 it('rejects imagined operations in arbitrary prose and failed tool results',()=>{
  const receipts=githubReceipt('github_develop',{ok:false,error:'GITHUB_WRITE_FAILED',status:403,value:{repository,action:'pull',number:73}});
  const report=formatGitHubRunEvidence(receipts);
  expect(report).toContain('GITHUB_WRITE_FAILED');
  expect(report).not.toContain('PR #73');
  expect(report).toContain('doğrulanmış dosya değişikliği');
  expect(githubReceipt('shell_run',{ok:true,value:{repository,action:'pull',number:73}})).toEqual([]);
 });
 it('does not transform a read into a successful file update',()=>{
  const rows=githubReceipt('github_read_file',{ok:true,value:{repository,path:'app.js',sha:blob,content:'PR #73 merged',truncated:true}});
  expect(rows[0]?.kind).toBe('read');
  expect(formatGitHubRunEvidence(rows)).not.toContain('PR #73');
 });
 it('requires read-back evidence for a commit',()=>{
  const value={repository,action:'file',branch:'hafize/auto-test',path:'app.js',commitSha:commit,blobSha:blob};
  expect(githubReceipt('github_develop',{ok:true,value})[0]?.kind).toBe('error');
  const verified=githubReceipt('github_develop',{ok:true,value:{...value,verified:true}});
  expect(verified[0]?.kind).toBe('file');
  expect(formatGitHubRunEvidence(verified)).toContain('/commit/'+commit);
 });
 it('distinguishes a genuine draft PR and a queued deploy from merge and live release',()=>{
  const draft=githubReceipt('github_develop',{ok:true,value:{repository,action:'pull',number:73,draft:true}});
  const dispatch=githubReceipt('github_release',{ok:true,value:{repository,action:'publish',dispatchAccepted:true,requestedSha:commit,published:false}});
  expect(formatGitHubRunEvidence([...draft,...dispatch])).toContain('PR #73');
  expect(formatGitHubRunEvidence([...draft,...dispatch])).toContain('Canlı yayın doğrulanmadı');
  expect(githubReceipt('github_release',{ok:true,value:{repository,action:'merge',number:73,merged:false,mergeCommitSha:commit}})[0]?.kind).toBe('error');
 });
 it('only reports CI runs tied to the exact SHA',()=>{
  const rows=githubReceipt('github_inspect',{ok:true,value:{repository,sha:commit,runs:[{id:1,headSha:blob,status:'completed',conclusion:'success'},{id:2,headSha:commit,status:'in_progress',conclusion:null}]}});
  const report=formatGitHubRunEvidence(rows);
  expect(report).not.toContain('CI #1');
  expect(report).toContain('CI #2');
  expect(report).toContain('in_progress / pending');
 });
 it('recognizes GitHub development and continuation without hijacking ordinary questions',()=>{
  expect(githubWorkRequested('Retake uygulamasını geliştir')).toBe(true);
  expect(githubWorkRequested('Kaldığın yerden devam et',['GitHub üzerinde kodu güncelle'])).toBe(true);
  expect(githubWorkRequested('GitHub nedir?')).toBe(false);
  expect(githubWorkRequested('Bugün hava nasıl?')).toBe(false);
 });
});

it('recovers an explicit file edit once after read-only progress but never retries an attempted mutation',()=>{
 const request='GitHub hafize/auto-example dalında public/typed/example.ts dosyasını düzenle, commit et ve doğrula. Yeni dal veya PR oluşturma.';
 const read=githubReceipt('github_read_file',{ok:true,value:{repository,path:'public/typed/example.ts',sha:blob}});
 expect(shouldRecoverReadOnlyWrite(request,read,[{name:'github_read_file',ok:true}])).toBe(true);
 expect(shouldRecoverReadOnlyWrite(request+' Commit etme.',read,[])).toBe(false);
 expect(shouldRecoverReadOnlyWrite('GitHub hafize/auto-example dalında dosyayı sadece oku.',read,[])).toBe(false);
 expect(shouldRecoverReadOnlyWrite(request,[],[])).toBe(false);
 expect(shouldRecoverReadOnlyWrite(request,read,[{name:'github_develop',ok:false}])).toBe(false);
 expect(shouldRecoverReadOnlyWrite(request,read,[{name:'github_release',ok:true}])).toBe(false);
 expect(shouldRecoverReadOnlyWrite(request.replace('hafize/auto-example','main'),read,[])).toBe(false);
});

it('distinguishes a reconciled existing merge from a new merge performed this turn',()=>{
 const rows=githubReceipt('github_release',{ok:true,value:{repository,action:'merge',number:73,merged:true,existing:true,mergeCommitSha:commit}});
 expect(formatGitHubRunEvidence(rows)).toContain('daha önce birleştirilmiş; GitHub üzerinden doğrulandı');
});

it('keeps the explicitly requested Retake branch and recovers after read-only development progress',()=>{
 const branch='hafize/auto-7cd111b639fb452aae94371609d77339';
 const request='Kaldığın yerden devam et. Retake deposundaki '+branch+' geliştirme dalını kontrol et. Önceki üç commit’i koru. Yarım kalan geliştirmeleri tamamla. Gerçek algoritma iyileştirmeleri yap, regresyon testleri ekle ve PR oluştur.';
 const read=githubReceipt('github_read_file',{ok:true,value:{repository,path:'tools/ultra_mode.py',sha:blob}});
 expect(requestedExistingFeatureBranch(request)).toBe(branch);
 expect(violatesExistingFeatureBranch(branch,'github_develop',{operation:'branch',repository})).toBe(true);
 expect(violatesExistingFeatureBranch(branch,'github_develop',{operation:'file',repository,branch:'hafize/auto-other'})).toBe(true);
 expect(violatesExistingFeatureBranch(branch,'github_develop',{operation:'file',repository,branch})).toBe(false);
 expect(violatesExistingFeatureBranch(branch,'github_develop',{operation:'pull',repository,branch})).toBe(false);
 expect(violatesExistingFeatureBranch(branch,'github_release',{action:'open',repository,branch:'hafize/auto-other'})).toBe(true);
 expect(shouldRecoverReadOnlyWrite(request,read,[])).toBe(true);
 expect(shouldRecoverReadOnlyWrite(request,[...read,...githubReceipt('github_develop',{ok:true,value:{repository,action:'branch',branch,fromSha:commit}})],[{name:'github_develop',operation:'branch',ok:true}])).toBe(true);
 expect(shouldRecoverReadOnlyWrite(request,read,[{name:'github_develop',operation:'file',ok:false}])).toBe(false);
 expect(shouldRecoverReadOnlyWrite(request+' Sadece incele.',read,[])).toBe(false);
 expect(requestedExistingFeatureBranch('Retake '+branch+' dalında çalış, yeni dal oluştur.')).toBeNull();
 expect(requestedExistingFeatureBranch('Retake '+branch+' dalında çalış, hafize/auto-other dalını kullan.')).toBeNull();
});

it('recovers from a blocked wrong-branch call without retrying uncertain writes',()=>{const request='Retake hafize/auto-example dalında dosyayı düzenle ve commit et.';const read=githubReceipt('github_read_file',{ok:true,value:{repository,path:'app.js',sha:blob}});const blocked=githubReceipt('github_develop',{ok:false,error:'GITHUB_REQUESTED_BRANCH_MISMATCH',status:400});expect(shouldRecoverReadOnlyWrite(request,[...read,...blocked],[{name:'github_develop',operation:'branch',ok:false,error:'GITHUB_REQUESTED_BRANCH_MISMATCH'}])).toBe(true);expect(shouldRecoverReadOnlyWrite(request,read,[{name:'github_develop',operation:'file',ok:false,error:'GITHUB_HEAD_MOVED'}])).toBe(false);});

it('reports exact live Render evidence and safe fixed error guidance',()=>{const rows=githubReceipt('github_release',{ok:true,value:{action:'publish',repository,target:'render',requestedSha:commit,published:true,existing:true}});expect(rows[0]?.kind).toBe('read');expect(formatGitHubRunEvidence(rows)).toContain('Yeni yayın isteği gönderilmedi');expect(formatGitHubRunEvidence(githubReceipt('github_develop',{ok:false,error:'INVALID_GITHUB_ARGUMENTS',reason:'GITHUB_ARGS_FILE'}))).toContain('Dosya parametreleri');expect(formatGitHubRunEvidence(githubReceipt('github_develop',{ok:false,error:'INVALID_GITHUB_ARGUMENTS',reason:'SECRET_EXAMPLE'}))).not.toContain('SECRET_EXAMPLE');});

it('inherits only an explicit existing branch from the preceding substantive user task',()=>{const prior='Retake hafize/auto-example dalında dosyayı düzenle ve commit et.';expect(continuationDevelopmentRequest('Kaldığın yerden devam et.',[prior,'Devam et.'])).toBe(prior);expect(continuationDevelopmentRequest('Devam et',[prior,'Bugün hava nasıl?'])).toBe('Devam et');expect(continuationDevelopmentRequest('Yeni dal oluştur',[prior])).toBe('Yeni dal oluştur');});

it('detects a requested PR missing after a verified code change without replaying a pull attempt',()=>{const request='Retake hafize/auto-example dalında kodu geliştir ve PR oluştur.';const rows=githubReceipt('github_develop',{ok:true,value:{action:'file',repository,branch:'hafize/auto-example',path:'app.js',commitSha:commit,blobSha:blob,verified:true}});const calls=[{name:'github_develop',operation:'file',ok:true}];expect(explicitPullRequested(request)).toBe(true);expect(shouldRecoverMissingPull(request,rows,calls)).toBe(true);expect(shouldRecoverMissingPull(request+' PR oluşturma.',rows,calls)).toBe(false);expect(shouldRecoverMissingPull(request,rows,[...calls,{name:'github_develop',operation:'pull',ok:false}])).toBe(false);expect(shouldRecoverMissingPull(request,[...rows,...githubReceipt('github_develop',{ok:true,value:{action:'pull',repository,number:8,draft:true}})],calls)).toBe(false);expect(shouldRecoverMissingPull(request,[],calls)).toBe(false);});

it('keeps the current named project and branch for repeated Turkish improvement follow-ups without reaching across unrelated topics',()=>{const prior='Retake hafize/auto-example dalında kodu geliştir, test ekle ve PR oluştur.';const short='Gerekli geliştirmeleri kapsamlı şekilde yap lütfen';expect(bareDevelopmentContinuation(short)).toBe(true);expect(githubWorkRequested(short,[prior,short,short])).toBe(true);expect(continuationDevelopmentRequest(short,[prior,short,short])).toBe(prior);expect(githubWorkRequested(short,[prior,'Bugün hava nasıl?',short])).toBe(false);expect(continuationDevelopmentRequest(short,[prior,'Bugün hava nasıl?'])).toBe(short);expect(githubWorkRequested('Bu tarifi geliştirmeye devam et',[prior])).toBe(false);expect(githubWorkRequested(short,[])).toBe(false);});

it('distinguishes an existing verified PR from a newly opened PR',()=>{const rows=githubReceipt('github_develop',{ok:true,value:{repository,action:'pull',number:73,draft:true,existing:true}});expect(formatGitHubRunEvidence(rows)).toContain('yeni PR açılmadı');});

it('continues a newly created verified branch for the Hafize design request without needing the user to name a branch',()=>{
 const repository='umitalgan061-sudo/hafize',branch='hafize/auto-cb902070982141b585079bbb7a45016a';
 const request='Hafize ana ekranındaki Sesli asistan küresini yeniden tasarla. GitHub main dalının güncel halinden ilerle. Gerçek kod değişikliklerini yap, test et, commit oluştur, PR aç, merge et ve Render üzerinden canlıya al.';
 const read=githubReceipt('github_read_file',{ok:true,value:{repository,path:'public/design-system.css',sha:blob}});
 const created=githubReceipt('github_develop',{ok:true,value:{repository,action:'branch',branch,fromSha:commit}});
 const rows=[...read,...created],calls=[{name:'github_read_file',ok:true},{name:'github_develop',operation:'branch',ok:true}];
 expect(verifiedCreatedFeatureBranch(rows)).toEqual({repository,branch});
 expect(shouldRecoverReadOnlyWrite(request,rows,calls)).toBe(true);
 expect(shouldRecoverReadOnlyWrite(request,read,calls)).toBe(false);
 expect(shouldRecoverReadOnlyWrite(request+' Sadece oku.',rows,calls)).toBe(false);
 expect(shouldRecoverReadOnlyWrite(request,rows,[...calls,{name:'github_develop',operation:'file',ok:false}])).toBe(false);
 expect(verifiedCreatedFeatureBranch([...rows,...githubReceipt('github_develop',{ok:true,value:{repository,action:'branch',branch:'hafize/auto-other',fromSha:commit}})])).toBeNull();
 expect(verifiedCreatedFeatureBranch([...rows,...githubReceipt('github_read_file',{ok:true,value:{repository:'other/repo',path:'app.js',sha:blob}})])).toBeNull();
 const file=githubReceipt('github_develop',{ok:true,value:{repository,action:'file',branch,path:'public/design-system.css',commitSha:commit,blobSha:blob,verified:true}});
 const written=[...rows,...file],writes=[...calls,{name:'github_develop',operation:'file',ok:true}];
 expect(shouldRecoverReadOnlyWrite(request,written,writes)).toBe(false);
 expect(shouldRecoverMissingPull(request,written,writes)).toBe(true);
 expect(shouldRecoverMissingPull(request+' PR açma.',written,writes)).toBe(false);
 expect(shouldRecoverMissingPull(request,written,[...writes,{name:'github_develop',operation:'pull',ok:false}])).toBe(false);
 expect(shouldRecoverMissingPull(request,[...written,...githubReceipt('github_develop',{ok:true,value:{repository,action:'pull',number:9}})],writes)).toBe(false);
});


describe('GitHub evidence scope and current-turn delivery',()=>{
 it('does not count an existing PR or merge as a new mutation',()=>{
  const pull=githubReceipt('github_develop',{ok:true,value:{repository,action:'pull',number:73,existing:true}});
  const merge=githubReceipt('github_release',{ok:true,value:{repository,action:'merge',number:73,merged:true,existing:true,mergeCommitSha:commit}});
  const report=formatGitHubRunEvidence([...pull,...merge]);
  expect(report).toContain('Bu turda doğrulanmış dosya değişikliği, PR, birleştirme veya yayın isteği yok.');
  expect(report).toContain('yeni PR açılmadı');
  expect(report).toContain('daha önce birleştirilmiş');
  const newPull=githubReceipt('github_develop',{ok:true,value:{repository,action:'pull',number:74}});
  expect(formatGitHubRunEvidence([...pull,...newPull])).not.toContain('Bu turda doğrulanmış dosya değişikliği');
 });
 it('requires verified file changes on the specifically requested branch before recovering a missing PR',()=>{
  const branch='hafize/auto-example',request='Retake '+branch+' dalında kodu geliştir ve PR oluştur.';
  const receipt=(repo:string,ref:string)=>githubReceipt('github_develop',{ok:true,value:{repository:repo,action:'file',branch:ref,path:'app.js',commitSha:commit,blobSha:blob,verified:true}});
  const calls=[{name:'github_develop',operation:'file',ok:true}];
  const correct=receipt(repository,branch),wrong=receipt(repository,'hafize/auto-other'),other=receipt('other/repo',branch);
  expect(shouldRecoverMissingPull(request,correct,calls)).toBe(true);
  expect(shouldRecoverMissingPull(request,wrong,calls)).toBe(false);
  expect(shouldRecoverMissingPull(request,[...correct,...wrong],calls)).toBe(false);
  expect(shouldRecoverMissingPull(request,[...correct,...other],calls)).toBe(false);
 });
});
