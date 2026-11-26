import type {DatabaseSync} from 'node:sqlite';
import {createCipheriv,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto';
import type {GitHubReceipt} from './github-run-evidence.ts';

type Cipher={encrypt(plain:string):string;decrypt(sealed:string):string};
type State='running'|'answered'|'incomplete'|'interrupted'|'cancelled';
export type Pending={tool:string;repository:string;operation:string;branch:string;path:string;sha:string;number:number|null;expectedBlob?:string};
type Body={receipts:GitHubReceipt[];pending:Pending[];answer:string};
type Row={id:string;owner_id:string;conversation_id:string;status:State;body_enc:string;updated_at:number;created_at:number};
const ID=/^[a-zA-Z0-9_-]{1,120}$/;
const REPO=/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const PATH=/^[a-zA-Z0-9_.\/-]{1,400}$/;
const SHA=/^[a-f0-9]{40}$/i;
const MAX_RECEIPTS=100;
const DAY=24*60*60*1000;
const safe=(v:unknown,p:RegExp)=>typeof v==='string'&&p.test(v)?v:'';
export const isAgentTurnId=(v:unknown):v is string=>typeof v==='string'&&ID.test(v);
export const durableGitHubTools=new Set(['github_read_file','github_inspect','github_develop','github_release','project_health','runtime_status','web_search','web_page_read']);
export const mutationTools=new Set(['github_develop','github_release']);
export function continuationRequested(value:unknown):boolean{
 const s=typeof value==='string'?value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/ı/g,'i'):'';
 return /\b(?:devam et|kaldigin yerden|tamamla|durma|continue|resume)\b/.test(s);
}
export function mutationIntent(tool:string,args:unknown):Pending|null{
 if(!mutationTools.has(tool))return null;
 let o:Record<string,unknown>={};
 try{const parsed=typeof args==='string'?JSON.parse(args):args;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))o=parsed as Record<string,unknown>;}catch{}
 return {tool,repository:safe(o.repository,REPO),operation:safe(o.operation??o.action,/^[a-z_]{1,30}$/),branch:safe(o.branch,PATH),path:safe(o.path,PATH),sha:safe(o.existingSha??o.sha,SHA),number:typeof o.number==='number'&&Number.isSafeInteger(o.number)&&o.number>0?o.number:null};
}
export function createAgentTurnCheckpoints({db,cipherFor,now=Date.now,recoveryKey}:{db:DatabaseSync;cipherFor:(owner:string)=>Cipher;now?:()=>number;recoveryKey?:Buffer}){
 db.exec('CREATE TABLE IF NOT EXISTS agent_turn_checkpoints (owner_id TEXT NOT NULL,id TEXT NOT NULL,conversation_id TEXT NOT NULL,status TEXT NOT NULL,body_enc TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(owner_id,id)); CREATE INDEX IF NOT EXISTS agent_turn_checkpoints_conversation ON agent_turn_checkpoints(owner_id,conversation_id,updated_at);');
 // Separate domain key: does not depend on per-owner keys in the ephemeral DB.
 const capsuleKey=recoveryKey&&recoveryKey.length>=32?Buffer.from(hkdfSync('sha256',recoveryKey,Buffer.alloc(0),'hafize-agent-checkpoint-capsule-v1',32)):null;
 const active=new Map<string,AbortController>();
 // Local admission fence: the outgoing process may keep serving during a
 // Render build. Do not admit new durable tasks after a self-deploy dispatch.
 // Bounded expiry avoids permanently locking a service after a failed build.
 let deployUntil=0;
 const deploymentPending=()=>now()<deployUntil;
 function reserveDeployment(owner:string,id:string){
  if(!active.has(key(owner,id))||active.size!==1||deploymentPending())return false;
  deployUntil=now()+15*60*1000;
  return true;
 }
 const key=(owner:string,id:string)=>owner+'\0'+id;
 const row=(owner:string,id:string)=>db.prepare('SELECT * FROM agent_turn_checkpoints WHERE owner_id=? AND id=?').get(owner,id) as Row|undefined;
 function read(r:Row):Body{
  const body=JSON.parse(cipherFor(r.owner_id).decrypt(r.body_enc)) as Body;
  return {receipts:Array.isArray(body.receipts)?body.receipts.slice(-MAX_RECEIPTS):[],pending:Array.isArray(body.pending)?body.pending:[],answer:typeof body.answer==='string'?body.answer:''};
 }
 function update(r:Row,status:State,body:Body){
  db.prepare('UPDATE agent_turn_checkpoints SET status=?,body_enc=?,updated_at=? WHERE owner_id=? AND id=?').run(status,cipherFor(r.owner_id).encrypt(JSON.stringify(body)),now(),r.owner_id,r.id);
 }
 function view(r:Row){
  const body=read(r);
  const status=r.status==='running'&&!active.has(key(r.owner_id,r.id))?'interrupted':r.status;
  return {id:r.id,conversationId:r.conversation_id,status,receipts:body.receipts,pending:body.pending,answer:body.answer,updatedAt:new Date(r.updated_at).toISOString()};
 }
 function get(owner:string,id:string){
  if(!owner||!isAgentTurnId(id))return null;
  const r=row(owner,id);return r?view(r):null;
 }
 function previous(owner:string,conversation:string){
  if(!owner||!isAgentTurnId(conversation))return null;
  const r=db.prepare('SELECT * FROM agent_turn_checkpoints WHERE owner_id=? AND conversation_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(owner,conversation) as Row|undefined;
  return r?view(r):null;
 }
 /** Authenticated browser backup, not a replay/authorization token. */
 function exportRecovery(owner:string,id:string):string{
  if(!capsuleKey)return '';
  const saved=get(owner,id);if(!saved)return '';
  const payload={id:saved.id,conversationId:saved.conversationId,status:saved.status,receipts:saved.receipts.slice(-24).map(r=>({...r,line:r.line.slice(0,900)})),pending:saved.pending.slice(0,20),answer:'',updatedAt:saved.updatedAt,issuedAt:now()};
  const raw=Buffer.from(JSON.stringify(payload));
  if(raw.length>45000)return '';
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',capsuleKey,iv);
  cipher.setAAD(Buffer.from(JSON.stringify(['hafize-agent-recovery-v1',owner,saved.conversationId])));
  const data=Buffer.concat([cipher.update(raw),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');
 }
 function importRecovery(owner:string,conversation:string,value:unknown){
  if(!capsuleKey||!owner||!isAgentTurnId(conversation)||typeof value!=='string'||value.length>64000)return null;
  const parts=value.split('.');if(parts.length!==4||parts[0]!=='v1'||!parts.slice(1).every(p=>/^[A-Za-z0-9_-]+$/.test(p)))return null;
  try{
   const iv=Buffer.from(parts[1]!,'base64url'),tag=Buffer.from(parts[2]!,'base64url');
   if(iv.length!==12||tag.length!==16)return null;
   const decipher=createDecipheriv('aes-256-gcm',capsuleKey,iv);decipher.setAAD(Buffer.from(JSON.stringify(['hafize-agent-recovery-v1',owner,conversation])));decipher.setAuthTag(tag);
   const payload=JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[3]!,'base64url')),decipher.final()]).toString('utf8'));
   if(!isAgentTurnId(payload.id)||payload.conversationId!==conversation||!['running','answered','incomplete','interrupted','cancelled'].includes(payload.status)||!Number.isSafeInteger(payload.issuedAt)||payload.issuedAt>now()||now()-payload.issuedAt>30*DAY||!Array.isArray(payload.receipts)||!Array.isArray(payload.pending)||payload.receipts.length>24||payload.pending.length>20)return null;
   return {id:payload.id as string,conversationId:conversation,status:payload.status as State,receipts:payload.receipts as GitHubReceipt[],pending:payload.pending as Pending[],answer:'',updatedAt:String(payload.updatedAt)};
  }catch{return null;}
 }
 // Preview only: a capsule cannot become a running task or refresh its own
 // expiration. Never replace a newer server record with browser history.
 function recoveryPreview(owner:string,conversation:string,id:string,value:unknown){
  if(!owner||!isAgentTurnId(conversation)||!isAgentTurnId(id))return null;
  const live=get(owner,id);
  if(live)return live.conversationId===conversation?{...live,recovered:false}:null;
  const saved=importRecovery(owner,conversation,value);
  if(!saved||saved.id!==id)return null;
  return {...saved,status:'interrupted' as const,snapshotStatus:saved.status,recovered:true};
 }
 function begin(owner:string,conversation:string,id:string,inheritedPending:Pending[]=[]){
  if(!owner||!isAgentTurnId(conversation)||!isAgentTurnId(id))return {accepted:false as const,reason:'INVALID_AGENT_TURN'};
  if(row(owner,id))return {accepted:false as const,reason:'AGENT_TURN_ALREADY_RECORDED'};
  if(deploymentPending())return {accepted:false as const,reason:'RENDER_DEPLOYMENT_PENDING'};
  if(previous(owner,conversation)?.status==='running')return {accepted:false as const,reason:'AGENT_TURN_ALREADY_RUNNING'};
  // Never delete an in-flight record. Old terminal history is bounded; uncertain
  // writes stay visible for at least the same retention interval.
  db.prepare("DELETE FROM agent_turn_checkpoints WHERE owner_id=? AND status!='running' AND updated_at<?").run(owner,now()-30*DAY);
  const count=db.prepare('SELECT COUNT(*) AS n FROM agent_turn_checkpoints WHERE owner_id=?').get(owner) as {n:number};
  if(Number(count.n)>=2000)return {accepted:false as const,reason:'AGENT_TURN_STORAGE_FULL'};
  const body:Body={receipts:[],pending:inheritedPending.slice(0,20),answer:''};
  db.prepare('INSERT INTO agent_turn_checkpoints(owner_id,id,conversation_id,status,body_enc,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(owner,id,conversation,'running',cipherFor(owner).encrypt(JSON.stringify(body)),now(),now());
  const controller=new AbortController();
  active.set(key(owner,id),controller);
  return {accepted:true as const,signal:controller.signal};
 }
 function before(owner:string,id:string,intents:Pending[]){
  const r=row(owner,id);if(!r||r.status!=='running')throw Error('AGENT_TURN_NOT_RUNNING');
  const body=read(r);body.pending.push(...intents);update(r,'running',body);
 }
 // Record only the approved, normalized result hash before the file PUT.
 // No source, approval ticket, credential or tool arguments in the journal.
 function preparedFile(owner:string,id:string,target:{repository:string;branch:string;path:string;expectedBlob:string}){
  const r=row(owner,id);if(!r||r.status!=='running'||!SHA.test(target.expectedBlob))throw Error('AGENT_TURN_NOT_RUNNING');
  const body=read(r);
  const matches=body.pending.filter(p=>p.tool==='github_develop'&&p.operation==='file'&&p.repository.toLowerCase()===target.repository.toLowerCase()&&p.branch===target.branch&&p.path===target.path);
  if(matches.length!==1)throw Error('AGENT_TURN_PENDING_TARGET_MISMATCH');
  matches[0]!.expectedBlob=target.expectedBlob;
  update(r,'running',body);
 }
 function checkpoint(owner:string,id:string,receipts:GitHubReceipt[],settled:Pending[]){
  const r=row(owner,id);if(!r||r.status!=='running')throw Error('AGENT_TURN_NOT_RUNNING');
  const body=read(r);body.receipts.push(...receipts);body.receipts=body.receipts.slice(-MAX_RECEIPTS);
  for(const intent of settled){const n=body.pending.findIndex(p=>p.tool===intent.tool&&p.repository===intent.repository&&p.operation===intent.operation&&p.branch===intent.branch&&p.path===intent.path&&p.sha===intent.sha&&p.number===intent.number);if(n>=0)body.pending.splice(n,1);}
  update(r,'running',body);
 }
 function finish(owner:string,id:string,status:Exclude<State,'running'>,answer=''){
  const r=row(owner,id);
  if(r?.status==='running'){
   const body=read(r);body.answer=answer.slice(0,64000);
   update(r,body.pending.length&&status==='answered'?'incomplete':status,body);
  }
  active.delete(key(owner,id));
 }
 function cancel(owner:string,id:string){
  if(!get(owner,id))return false;
  const controller=active.get(key(owner,id));if(!controller)return false;
  controller.abort(new Error('AGENT_TURN_CANCELLED'));return true;
 }
 function cancelAll(){for(const controller of active.values())controller.abort(new Error('AGENT_TURN_SERVER_SHUTDOWN'));}
 return Object.freeze({begin,get,previous,before,preparedFile,checkpoint,finish,cancel,cancelAll,hasActive:()=>active.size>0,activeCount:()=>active.size,reserveDeployment,deploymentPending,exportRecovery,importRecovery,recoveryPreview,recoveryAvailable:()=>Boolean(capsuleKey)});
}
export type AgentTurnCheckpoints=ReturnType<typeof createAgentTurnCheckpoints>;
