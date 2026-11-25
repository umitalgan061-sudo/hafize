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
