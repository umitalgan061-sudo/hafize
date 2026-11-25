import {describe,it,expect} from 'vitest';
import {compactToolActivities,recoverCloudWait,CLOUD_WAIT_TEXT,INTERRUPTED_TEXT,settleToolActivities,agentStreamFailure,missingCheckpointAnswer,checkpointEvidence,withCheckpointEvidence} from './agent-turn-recovery.ts';
describe('agent activity and interrupted turn regression',()=>{
 it('deduplicates separated legacy badges without counters or duplicated GitHub state',()=>{
  const a=compactToolActivities([
   {label:'GitHub dosyası okunamadı',state:'failure'},
   {label:'GitHub durumu okundu',state:'success'},
   {label:'GitHub dosyası okunamadı',state:'failure'},
   {label:'GitHub durumu okundu x5',state:'success'},
   {label:'GitHub dosyası okundu',state:'success'},
   {label:'GitHub dosyası okunamadı',state:'failure'}]);
  expect(a.map(x=>x.label)).toEqual(['GitHub durumu okundu','GitHub dosyası okunamadı']);
 });
 it('uses tool identity and never replaces a different running tool',()=>{
  const a=compactToolActivities([{tool:'github_read_file',label:'GitHub dosyası okunuyor',state:'running'},{tool:'github_inspect',label:'GitHub durumu doğrulanıyor',state:'running'},{tool:'github_read_file',label:'GitHub dosyası okunamadı',state:'failure',error:'GITHUB_REPO_NOT_ALLOWED'}]);
  expect(a).toHaveLength(2);expect(a[0].state).toBe('running');expect(a[1].error).toBe('GITHUB_REPO_NOT_ALLOWED');
  expect(settleToolActivities(a).every(x=>x.state!=='running')).toBe(true);
 });
 it('never preserves an unconfirmed cloud wait forever',()=>{
  expect(recoverCloudWait(CLOUD_WAIT_TEXT,false)).toBe(INTERRUPTED_TEXT);
  expect(recoverCloudWait(CLOUD_WAIT_TEXT,true)).toBe(CLOUD_WAIT_TEXT);
  expect(recoverCloudWait('Gerçek cevap',false)).toBe('Gerçek cevap');
 });
});

it('preserves the original error and distinguishes absent from previously confirmed checkpoints',()=>{
 const failure=agentStreamFailure({code:'AGENT_TURN_ALREADY_RUNNING',status:409},false);
 expect(failure).toContain('AGENT_TURN_ALREADY_RUNNING (HTTP 409)');
 expect(missingCheckpointAnswer(failure,false)).toContain(failure);
 expect(missingCheckpointAnswer(failure,false)).toContain('oluşturulduğu doğrulanmamıştı');
 expect(missingCheckpointAnswer('Verified partial report',true)).toContain('Verified partial report');
 expect(missingCheckpointAnswer('Verified partial report',true)).toContain('artık bulunamıyor');
 expect(missingCheckpointAnswer('Görev sunucuya gönderiliyor…',false)).not.toContain('gönderiliyor');
 expect(agentStreamFailure({code:'injected secret message',status:503},true)).not.toContain('injected');
});

it('retains bounded journal evidence across missing server checkpoints without duplicate reports',()=>{
 const evidence='- repo — verified commit abc\n\nSonucu belirsiz yazma hedefleri: PR #9';
 const failure=agentStreamFailure({code:'STREAM_INTERRUPTED'},true);
 const combined=withCheckpointEvidence(failure,evidence);
 expect(combined).toContain(evidence);
 expect(missingCheckpointAnswer(combined,true)).toContain('PR #9');
 expect(withCheckpointEvidence(combined,evidence)).toBe(combined);
 expect(checkpointEvidence('x'.repeat(40000))).toHaveLength(32000);
 expect(checkpointEvidence({secret:'never coerce objects'})).toBe('');
});
