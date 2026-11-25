import { describe, expect, it } from 'vitest';
import { githubWorkRequested, githubReceipt, formatGitHubRunEvidence, shouldRecoverReadOnlyWrite, requestedExistingFeatureBranch, violatesExistingFeatureBranch } from './github-run-evidence.ts';
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
