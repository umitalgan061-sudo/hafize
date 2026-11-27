import {describe,it,expect,vi} from 'vitest';
import {createUpstashAgentJournal} from './upstash-agent-journal.ts';
const env={UPSTASH_REDIS_REST_URL:'https://example-123.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test-only-token'};
const recoveryKey=Buffer.alloc(32,8);
function fake(){
 const data=new Map<string,string>();
 const requests:(string|number)[][]=[];
 const fetchImpl=vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
  const args=JSON.parse(String(init?.body)) as (string|number)[];requests.push(args);
  if(args[0]==='GET')return Response.json({result:data.get(String(args[1]))??null});
  if(args[0]==='EVAL'){
   const name=String(args[3]),old=String(args[4]),next=String(args[5]);
   if((data.get(name)??'')!==old)return Response.json({result:0});
   data.set(name,next);return Response.json({result:1});
  }
  return Response.json({error:'unexpected'},{status:400});
 });
 return {data,requests,fetchImpl};
}
const snapshot={id:'turn-1',conversationId:'chat-1',status:'running' as const,receipts:[],pending:[],answer:'',updatedAt:'2026-11-27T00:00:00Z'};
describe('encrypted Upstash task journal',()=>{
 it('survives process replacement, preserves pending work, and uses opaque keys and ciphertext',async()=>{
  const f=fake();let time=1000;
  const a=createUpstashAgentJournal({env,recoveryKey,fetchImpl:f.fetchImpl,now:()=>time})!;
  const loaded=await a.load('owner','chat-1');
  const pending={tool:'github_develop',repository:'owner/repo',operation:'file',branch:'hafize/auto-test',path:'app.ts',sha:'a'.repeat(40),number:null,expectedBlob:'b'.repeat(40)};
  await a.session('owner','chat-1',loaded).save(()=>({...snapshot,pending:[pending]}));
  expect(JSON.stringify([...f.data])).not.toContain('owner/repo');expect(JSON.stringify([...f.data])).not.toContain('chat-1');expect(JSON.stringify([...f.data])).not.toContain('test-only-token');
  const b=createUpstashAgentJournal({env,recoveryKey,fetchImpl:f.fetchImpl,now:()=>time})!;
  const recovered=await b.load('owner','chat-1');
  expect(recovered.record?.snapshot.pending).toEqual([pending]);expect(b.isBusy(recovered)).toBe(true);
  time+=5*60*1000+1;expect(b.isBusy(recovered)).toBe(false);
  expect((await b.load('other','chat-1')).record).toBeNull();
  expect(f.requests.find(a=>a[0]==='EVAL')?.[6]).toBe(0);
 });
 it('fences stale sessions and serializes writes without replay',async()=>{
  const f=fake();const j=createUpstashAgentJournal({env,recoveryKey,fetchImpl:f.fetchImpl})!;
  const old=await j.load('owner','chat-1'),a=j.session('owner','chat-1',old),b=j.session('owner','chat-1',old);
  await Promise.all([a.save(()=>snapshot),a.save(()=>({...snapshot,status:'incomplete'}))]);
  await expect(b.save(()=>snapshot)).rejects.toThrow('AGENT_JOURNAL_CONFLICT');
  const n=f.requests.length;await expect(b.save(()=>snapshot)).rejects.toThrow('AGENT_JOURNAL_CONFLICT');expect(f.requests.length).toBe(n);
  expect((await j.load('owner','chat-1')).record?.snapshot.status).toBe('incomplete');
  expect(f.requests.filter(a=>a[0]==='EVAL')[1]?.[6]).toBe(30*24*60*60);
 });
 it('fails closed on invalid config, provider outage and corrupted records',async()=>{
  const f=fake();expect(createUpstashAgentJournal({env:{},recoveryKey})).toBeNull();
  const invalid=createUpstashAgentJournal({env:{...env,UPSTASH_REDIS_REST_URL:'https://attacker.example'},recoveryKey,fetchImpl:f.fetchImpl})!;
  await expect(invalid.load('owner','chat-1')).rejects.toThrow('AGENT_JOURNAL_CONFIG_INVALID');expect(f.fetchImpl).not.toHaveBeenCalled();
  const down=createUpstashAgentJournal({env,recoveryKey,fetchImpl:async()=>new Response('secret',{status:503})})!;
  await expect(down.load('owner','chat-1')).rejects.toThrow('AGENT_JOURNAL_UNAVAILABLE');
  const j=createUpstashAgentJournal({env,recoveryKey,fetchImpl:f.fetchImpl})!;
  await j.session('owner','chat-1',await j.load('owner','chat-1')).save(()=>snapshot);
  for(const key of f.data.keys())f.data.set(key,'invalid');
  await expect(j.load('owner','chat-1')).rejects.toThrow('AGENT_JOURNAL_CORRUPT');
 });
});

it('renews an active journal during long model or CI waits and stops after terminal state',async()=>{
 const f=fake();let time=1000;
 const j=createUpstashAgentJournal({env,recoveryKey,fetchImpl:f.fetchImpl,now:()=>time})!;
 const session=j.session('owner','chat-1',await j.load('owner','chat-1'));
 await session.save(()=>snapshot);
 const n=f.requests.length;await session.renew();expect(f.requests.length).toBe(n);
 time+=4*60*1000;await session.renew();
 time+=2*60*1000;expect(j.isBusy(await j.load('owner','chat-1'))).toBe(true);
 await session.save(()=>({...snapshot,status:'answered'}));
 time+=60_000;const terminal=f.requests.length;await session.renew();expect(f.requests.length).toBe(terminal);
 expect(j.isBusy(await j.load('owner','chat-1'))).toBe(false);
});
it('fails closed on a stale heartbeat and never overwrites the new process checkpoint',async()=>{
 const f=fake();let time=1000;
 const j=createUpstashAgentJournal({env,recoveryKey,fetchImpl:f.fetchImpl,now:()=>time})!;
 const a=j.session('owner','chat-1',await j.load('owner','chat-1'));await a.save(()=>snapshot);
 time+=6*60*1000;
 const b=j.session('owner','chat-1',await j.load('owner','chat-1'));await b.save(()=>({...snapshot,id:'turn-2',status:'incomplete'}));
 await expect(a.renew()).rejects.toThrow('AGENT_JOURNAL_CONFLICT');
 await expect(a.save(()=>snapshot)).rejects.toThrow('AGENT_JOURNAL_CONFLICT');
 expect((await j.load('owner','chat-1')).record?.snapshot.id).toBe('turn-2');
});

it('recovers exact latest terminal or active result after process replacement without a browser capsule',async()=>{
 const f=fake();let time=1000;
 const a=createUpstashAgentJournal({env,recoveryKey,fetchImpl:f.fetchImpl,now:()=>time})!;
 const session=a.session('owner','chat-1',await a.load('owner','chat-1'));
 await session.save(()=>snapshot);
 const b=createUpstashAgentJournal({env,recoveryKey,fetchImpl:f.fetchImpl,now:()=>time})!;
 expect(await b.preview('owner','chat-1','turn-1')).toMatchObject({id:'turn-1',status:'running',source:'redis',recovered:false});
 time+=6*60*1000;
 expect(await b.preview('owner','chat-1','turn-1')).toMatchObject({status:'interrupted'});
 await session.save(()=>({...snapshot,status:'answered',answer:'verified result'}));
 const writes=f.requests.filter(x=>x[0]==='EVAL').length;
 expect(await b.preview('owner','chat-1','turn-1')).toMatchObject({status:'answered',answer:'verified result',source:'redis'});
 expect(await b.preview('owner','chat-1','other-turn')).toBeNull();
 expect(await b.preview('other-owner','chat-1','turn-1')).toBeNull();
 expect(await b.preview('owner','other-chat','turn-1')).toBeNull();
 expect(await b.preview('owner','../bad','turn-1')).toBeNull();
 expect(f.requests.filter(x=>x[0]==='EVAL')).toHaveLength(writes);
});
