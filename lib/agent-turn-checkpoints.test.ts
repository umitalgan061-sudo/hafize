import {DatabaseSync} from 'node:sqlite';
import {describe,it,expect} from 'vitest';
import {createAgentTurnCheckpoints,mutationIntent,continuationRequested,durableGitHubTools} from './agent-turn-checkpoints.ts';
const cipherFor=(owner:string)=>({encrypt:(s:string)=>Buffer.from(owner+'\0'+s).toString('base64'),decrypt:(s:string)=>{const raw=Buffer.from(s,'base64').toString();if(!raw.startsWith(owner+'\0'))throw Error('owner');return raw.slice(owner.length+1);}});
const receipt={tool:'github_develop',kind:'file' as const,line:'verified commit'};
const intent=mutationIntent('github_develop',JSON.stringify({operation:'file',repository:'owner/repo',branch:'hafize/auto-test',path:'app.js',existingSha:'a'.repeat(40),content:'do not store this'}))!;
describe('agent checkpoint storage and reconnection',()=>{
 it('retains completed receipts and rejects duplicate/reentrant requests',()=>{
  const db=new DatabaseSync(':memory:');const turns=createAgentTurnCheckpoints({db,cipherFor});
  expect(turns.begin('owner','chat','turn').accepted).toBe(true);
  expect(turns.begin('owner','chat','turn').accepted).toBe(false);
  expect(turns.begin('owner','chat','second').accepted).toBe(false);
  turns.before('owner','turn',[intent]);turns.checkpoint('owner','turn',[receipt],[intent]);
  turns.finish('owner','turn','answered','answer');
  expect(turns.get('owner','turn')).toMatchObject({status:'answered',answer:'answer',pending:[],receipts:[receipt]});
  expect(turns.begin('owner','chat','turn').accepted).toBe(false);
  expect(turns.get('other','turn')).toBeNull();expect(turns.cancel('other','turn')).toBe(false);db.close();
 });
 it('retains uncertain writes after restart without replaying them',()=>{
  const db=new DatabaseSync(':memory:');const first=createAgentTurnCheckpoints({db,cipherFor});
  first.begin('owner','chat','turn');first.before('owner','turn',[intent]);
  const restarted=createAgentTurnCheckpoints({db,cipherFor});
  expect(restarted.previous('owner','chat')).toMatchObject({status:'interrupted',pending:[intent]});
  expect(restarted.begin('owner','chat','next',[intent]).accepted).toBe(true);
  expect(restarted.get('owner','next')?.pending).toEqual([intent]);
  restarted.finish('owner','next','answered','not verified');
  expect(restarted.get('owner','next')?.status).toBe('incomplete');
  expect(JSON.stringify(intent)).not.toContain('do not store this');db.close();
 });
 it('can cancel detached work only with the same owner and id',()=>{
  const db=new DatabaseSync(':memory:');const turns=createAgentTurnCheckpoints({db,cipherFor});
  const handle=turns.begin('owner','chat','turn');if(!handle.accepted)throw Error('unexpected');
  expect(handle.signal.aborted).toBe(false);expect(turns.cancel('other','turn')).toBe(false);
  expect(turns.cancel('owner','turn')).toBe(true);expect(handle.signal.aborted).toBe(true);
  turns.finish('owner','turn','interrupted');expect(turns.get('owner','turn')?.status).toBe('interrupted');db.close();
 });
 it('allows only scoped detached tools and recognizes continuation',()=>{
  expect(durableGitHubTools.has('shell_run')).toBe(false);expect(durableGitHubTools.has('agent_delegate')).toBe(false);
  expect(durableGitHubTools.has('github_develop')).toBe(true);
  expect(continuationRequested('Kaldığın yerden devam et')).toBe(true);
 });
});

it('exposes only whether a durable turn is active, including cancellation until finish',()=>{
 const db=new DatabaseSync(':memory:'),turns=createAgentTurnCheckpoints({db,cipherFor});
 expect(turns.hasActive()).toBe(false);
 turns.begin('owner','chat','turn');expect(turns.hasActive()).toBe(true);
 turns.cancelAll();expect(turns.hasActive()).toBe(true);
 turns.finish('owner','turn','interrupted');expect(turns.hasActive()).toBe(false);db.close();
});

it('counts concurrent task activity without exposing owner or conversation data',()=>{const db=new DatabaseSync(':memory:'),turns=createAgentTurnCheckpoints({db,cipherFor});turns.begin('owner','chat1','turn1');turns.begin('owner','chat2','turn2');expect(turns.activeCount()).toBe(2);turns.finish('owner','turn1','answered');expect(turns.activeCount()).toBe(1);db.close();});

it('reserves self-deployment only for the sole active task and fences new tasks until process replacement or bounded expiry',()=>{let time=1000;const db=new DatabaseSync(':memory:'),turns=createAgentTurnCheckpoints({db,cipherFor,now:()=>time});expect(turns.reserveDeployment('owner','missing')).toBe(false);turns.begin('owner','chat1','turn1');turns.begin('owner','chat2','turn2');expect(turns.reserveDeployment('owner','turn1')).toBe(false);turns.finish('owner','turn2','answered');expect(turns.reserveDeployment('other','turn1')).toBe(false);expect(turns.reserveDeployment('owner','turn1')).toBe(true);expect(turns.reserveDeployment('owner','turn1')).toBe(false);turns.finish('owner','turn1','answered');expect(turns.begin('owner','chat3','turn3')).toMatchObject({accepted:false,reason:'RENDER_DEPLOYMENT_PENDING'});time+=15*60*1000;expect(turns.begin('owner','chat3','turn3').accepted).toBe(true);db.close();});

it('restores encrypted checkpoint evidence on an empty DB with a stable key, bound to owner and conversation',()=>{let time=1000;const key=Buffer.alloc(32,7);const db=new DatabaseSync(':memory:'),a=createAgentTurnCheckpoints({db,cipherFor,recoveryKey:key,now:()=>time});a.begin('owner','chat','turn');a.before('owner','turn',[intent]);a.checkpoint('owner','turn',[receipt],[]);const token=a.exportRecovery('owner','turn');expect(token).toMatch(/^v1\./);expect(token).not.toContain('verified commit');db.close();const db2=new DatabaseSync(':memory:'),b=createAgentTurnCheckpoints({db:db2,cipherFor,recoveryKey:key,now:()=>time});expect(b.previous('owner','chat')).toBeNull();expect(b.importRecovery('owner','chat',token)).toMatchObject({status:'running',pending:[intent],receipts:[receipt]});expect(b.importRecovery('other','chat',token)).toBeNull();expect(b.importRecovery('owner','other',token)).toBeNull();const pieces=token.split('.');pieces[3]=(pieces[3]![0]==='A'?'B':'A')+pieces[3]!.slice(1);expect(b.importRecovery('owner','chat',pieces.join('.'))).toBeNull();time+=31*86400000;expect(b.importRecovery('owner','chat',token)).toBeNull();db2.close();});
it('does not issue a recovery capsule when no stable server key is configured',()=>{const db=new DatabaseSync(':memory:'),t=createAgentTurnCheckpoints({db,cipherFor});t.begin('owner','chat','turn');expect(t.exportRecovery('owner','turn')).toBe('');expect(t.importRecovery('owner','chat','v1.a.b.c')).toBeNull();db.close();});

it('previews an authenticated snapshot without restoring running state, extending expiry or creating a record',()=>{let time=1000;const recoveryKey=Buffer.alloc(32,8);const db=new DatabaseSync(':memory:'),a=createAgentTurnCheckpoints({db,cipherFor,recoveryKey,now:()=>time});a.begin('owner','chat','turn');a.before('owner','turn',[intent]);const token=a.exportRecovery('owner','turn');expect(a.recoveryPreview('owner','chat','turn',token)).toMatchObject({status:'running',recovered:false});db.close();const db2=new DatabaseSync(':memory:'),b=createAgentTurnCheckpoints({db:db2,cipherFor,recoveryKey,now:()=>time});expect(b.recoveryPreview('owner','chat','turn',token)).toMatchObject({status:'interrupted',snapshotStatus:'running',recovered:true,pending:[intent]});expect(b.get('owner','turn')).toBeNull();expect(b.hasActive()).toBe(false);expect(b.recoveryPreview('owner','chat','another',token)).toBeNull();expect(b.recoveryPreview('other','chat','turn',token)).toBeNull();expect(b.recoveryPreview('owner','other','turn',token)).toBeNull();time+=31*86400000;expect(b.recoveryPreview('owner','chat','turn',token)).toBeNull();db2.close();});

it('records an approved expected blob without source and settles the original target identity',()=>{const db=new DatabaseSync(':memory:'),t=createAgentTurnCheckpoints({db,cipherFor});t.begin('owner','chat','turn');t.before('owner','turn',[intent]);const target={repository:intent.repository,branch:intent.branch,path:intent.path,expectedBlob:'b'.repeat(40)};expect(()=>t.preparedFile('owner','turn',{...target,path:'different.js'})).toThrow();t.preparedFile('owner','turn',target);expect(t.get('owner','turn')?.pending).toEqual([{...intent,expectedBlob:target.expectedBlob}]);expect(JSON.stringify(t.get('owner','turn'))).not.toContain('do not store this');t.checkpoint('owner','turn',[receipt],[intent]);expect(t.get('owner','turn')?.pending).toEqual([]);db.close();});

it('preserves the generated branch name before creation without changing original intent identity',()=>{const db=new DatabaseSync(':memory:'),t=createAgentTurnCheckpoints({db,cipherFor});t.begin('owner','chat','turn');const p=mutationIntent('github_develop',{operation:'branch',repository:'owner/repo'})!;t.before('owner','turn',[p]);t.preparedBranch('owner','turn',{repository:'owner/repo',branch:'hafize/auto-generated'});expect(t.get('owner','turn')?.pending).toEqual([{...p,preparedBranch:'hafize/auto-generated'}]);t.checkpoint('owner','turn',[],[p]);expect(t.get('owner','turn')?.pending).toEqual([]);db.close();});

it('recognizes the recurring Turkish improvement request as a checkpoint continuation',()=>{expect(continuationRequested('Gerekli geliştirmeleri kapsamlı şekilde yap lütfen')).toBe(true);expect(continuationRequested('Bugün hava nasıl?')).toBe(false);});

it('blocks mirror deployment while even one agent task is running and fences new tasks when idle',()=>{let time=1000;const db=new DatabaseSync(':memory:'),turns=createAgentTurnCheckpoints({db,cipherFor,now:()=>time});turns.begin('owner','chat','turn');expect(turns.reserveIdleDeployment()).toBe(false);turns.finish('owner','turn','answered');expect(turns.reserveIdleDeployment()).toBe(true);expect(turns.reserveIdleDeployment()).toBe(false);expect(turns.begin('owner','chat','next')).toMatchObject({accepted:false,reason:'RENDER_DEPLOYMENT_PENDING'});time+=15*60*1000;expect(turns.begin('owner','chat','next').accepted).toBe(true);db.close();});
