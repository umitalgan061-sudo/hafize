import {createCipheriv,createDecipheriv,createHmac,hkdfSync,randomBytes} from 'node:crypto';
import type {AgentTurnCheckpoints} from './agent-turn-checkpoints.ts';

type Snapshot=NonNullable<ReturnType<AgentTurnCheckpoints['get']>>;
type RecordValue={snapshot:Snapshot;leaseUntil:number};
type Loaded={raw:string|null;record:RecordValue|null};
const ACTIVE_MS=5*60*1000;
export const AGENT_JOURNAL_HEARTBEAT_MS=60_000;
const RETAIN_SECONDS=30*24*60*60;
const MAX_RAW=800_000;
const ID=/^[a-zA-Z0-9_-]{1,120}$/;
// One atomic compare-and-set per conversation. Never expire unresolved work.
const CAS="local current=redis.call('GET',KEYS[1]); if (ARGV[1]=='' and current) or (ARGV[1]~='' and current~=ARGV[1]) then return 0 end; if tonumber(ARGV[3])>0 then redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]) else redis.call('SET',KEYS[1],ARGV[2]) end; return 1";
const fail=(code:string):never=>{throw Object.assign(new Error(code),{code});};

/** Optional remote latest-turn journal. No source, credentials, or raw owner
 * IDs in Redis. An unreachable configured store fails closed for durable work.
 * CAS protects against overlapping old/new Render processes. A lease expiry
 * permits a new inspection, not replay of a pending external mutation. */
export function createUpstashAgentJournal({env,recoveryKey,fetchImpl=globalThis.fetch,now=Date.now}:{env:Record<string,string|undefined>;recoveryKey?:Buffer;fetchImpl?:typeof fetch;now?:()=>number}){
 const url=env.UPSTASH_REDIS_REST_URL?.trim()||'';
 const token=env.UPSTASH_REDIS_REST_TOKEN?.trim()||'';
 if(!url&&!token)return null;
 let endpoint:URL|null=null;
 try{const u=new URL(url);if(u.protocol==='https:'&&/^[a-z0-9-]+\.upstash\.io$/i.test(u.hostname)&&u.port===''&&u.pathname==='/'&&!u.username&&!u.password&&!u.search&&!u.hash)endpoint=u;}catch{}
 const key=recoveryKey&&recoveryKey.length>=32?Buffer.from(hkdfSync('sha256',recoveryKey,Buffer.alloc(0),'hafize-remote-agent-journal-v1',32)):null;
 const configured=Boolean(endpoint&&token&&token.length<=4096&&key);
 function storageKey(owner:string,conversation:string){
  if(!configured||!key||!owner||!ID.test(conversation))return fail('AGENT_JOURNAL_CONFIG_INVALID');
  return 'hafize:agent:v1:'+createHmac('sha256',key).update(JSON.stringify([owner,conversation])).digest('hex');
 }
 async function command(args:(string|number)[]){
  if(!configured||!endpoint)return fail('AGENT_JOURNAL_CONFIG_INVALID');
  try{
   const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
   if(!response.ok){await response.body?.cancel().catch(()=>{});return fail('AGENT_JOURNAL_UNAVAILABLE');}
   const result=await response.json();
   if(!result||typeof result!=='object'||result.error||!Object.hasOwn(result,'result'))return fail('AGENT_JOURNAL_UNAVAILABLE');
   return result.result as unknown;
  }catch{return fail('AGENT_JOURNAL_UNAVAILABLE');}
 }
 function seal(name:string,record:RecordValue){
  if(!key)return fail('AGENT_JOURNAL_CONFIG_INVALID');
  if(record.snapshot.pending.length>20||record.snapshot.receipts.length>100)return fail('AGENT_JOURNAL_LIMIT');
  const raw=Buffer.from(JSON.stringify(record));
  if(raw.length>500_000)return fail('AGENT_JOURNAL_LIMIT');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(name));
  const data=Buffer.concat([cipher.update(raw),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');
 }
 function open(name:string,conversation:string,raw:string):RecordValue{
  try{
   if(!key||raw.length>MAX_RAW)throw Error();
   const [version,iv,tag,body,...rest]=raw.split('.');
   if(version!=='v1'||!iv||!tag||!body||rest.length)throw Error();
   const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));
   decipher.setAAD(Buffer.from(name));decipher.setAuthTag(Buffer.from(tag,'base64url'));
   const result=JSON.parse(Buffer.concat([decipher.update(Buffer.from(body,'base64url')),decipher.final()]).toString('utf8')) as RecordValue;
   const s=result.snapshot;
   if(!s||!ID.test(s.id)||s.conversationId!==conversation||!['running','answered','incomplete','interrupted','cancelled'].includes(s.status)||!Array.isArray(s.receipts)||s.receipts.length>100||!Array.isArray(s.pending)||s.pending.length>20||typeof s.answer!=='string'||typeof s.updatedAt!=='string'||!Number.isSafeInteger(result.leaseUntil))throw Error();
   return result;
  }catch{return fail('AGENT_JOURNAL_CORRUPT');}
 }
 async function load(owner:string,conversation:string):Promise<Loaded>{
  const name=storageKey(owner,conversation),raw=await command(['GET',name]);
  if(raw===null)return {raw:null,record:null};
  if(typeof raw!=='string')return fail('AGENT_JOURNAL_CORRUPT');
  return {raw,record:open(name,conversation,raw)};
 }
 function session(owner:string,conversation:string,loaded:Loaded){
  const name=storageKey(owner,conversation);
  let expected=loaded.raw;
  let tail:Promise<void>=Promise.resolve();
  let lastSaved:RecordValue|null=null;
  // Serialize concurrent tool receipts. A failed CAS poisons the session:
  // no fallback to SQLite-only writes and no speculative retry.
  function save(read:()=>Snapshot|null){
   const work=tail.then(async()=>{
    const snapshot=read();
    if(!snapshot||snapshot.conversationId!==conversation)return fail('AGENT_JOURNAL_STATE_INVALID');
    const running=snapshot.status==='running';
    const record={snapshot,leaseUntil:running?now()+ACTIVE_MS:0};
    const next=seal(name,record);
    const ttl=running||snapshot.pending.length?0:RETAIN_SECONDS;
    const ok=await command(['EVAL',CAS,1,name,expected||'',next,ttl]);
    if(ok!==1)return fail('AGENT_JOURNAL_CONFLICT');
    expected=next;
    lastSaved=record;
   });
   tail=work;
   return work;
  }
  // Heartbeat uses the last acknowledged snapshot, never uncommitted local
  // data. Serialize behind saves; no-op if a terminal record was committed.
  function renew(){
   const work=tail.then(async()=>{
    if(!lastSaved||lastSaved.snapshot.status!=='running')return;
    if(lastSaved.leaseUntil-now()>ACTIVE_MS-AGENT_JOURNAL_HEARTBEAT_MS)return;
    const record={...lastSaved,leaseUntil:now()+ACTIVE_MS};
    const next=seal(name,record);
    const ok=await command(['EVAL',CAS,1,name,expected||'',next,0]);
    if(ok!==1)return fail('AGENT_JOURNAL_CONFLICT');
    expected=next;lastSaved=record;
   });
   tail=work;return work;
  }
  return {save,renew};
 }
 const isBusy=(loaded:Loaded)=>loaded.record?.snapshot.status==='running'&&loaded.record.leaseUntil>now();
 /** Read-only result recovery scoped to the authenticated owner, exact
  * conversation and turn. Never renew a lease or restore executable state. */
 async function preview(owner:string,conversation:string,id:string){
  if(!ID.test(conversation)||!ID.test(id))return null;
  const loaded=await load(owner,conversation);
  const snapshot=loaded.record?.snapshot;
  if(!snapshot||snapshot.id!==id)return null;
  const status=snapshot.status==='running'&&!isBusy(loaded)?'interrupted' as const:snapshot.status;
  return {...snapshot,status,recovered:false as const,source:'redis' as const};
 }
 return {configured,load,session,isBusy,preview};
}
