import {createHash,timingSafeEqual} from 'node:crypto';
import {OWNER_PROJECTS} from './owner-project-catalog.ts';
import {createRateLimiter} from './rate-limit.ts';
import {containsPlaintextCredential} from './plaintext-credential-policy.ts';
import {completionOrigin} from './model-response-origin.ts';
type Json=Record<string,unknown>;
const fail=(code:string,status=400):never=>{throw Object.assign(new Error(code),{code,status});};
const obj=(v:unknown):Json=>v&&typeof v==='object'&&!Array.isArray(v)?v as Json:fail('PROJECT_AI_INVALID_INPUT');
const projectIds=new Set<string>(OWNER_PROJECTS.map(p=>p.id).filter(p=>p!=='hafize'&&p!=='hafize-legacy'));
/** Only a separate SHA-256 digest for each explicitly configured project. Never use
 * owner/connector/NVIDIA credentials as project credentials. No client-selected model,
 * tools, remote URLs, memory, workspace, or agent execution. */
export function createProjectAiGateway({hashes,model,complete}:{hashes?:string;model:string;complete:(payload:Json,signal?:AbortSignal)=>Promise<unknown>}){
 const configured=new Map<string,Buffer>();
 if(hashes){try{
   const parsed=obj(JSON.parse(hashes));const entries=Object.entries(parsed);
   if(!entries.length||entries.some(([id,v])=>!projectIds.has(id)||typeof v!=='string'||!/^[a-f0-9]{64}$/i.test(v)))throw Error();
   const unique=new Set(entries.map(([,v])=>String(v).toLowerCase()));if(unique.size!==entries.length)throw Error();
   for(const [id,v] of entries)configured.set(id,Buffer.from(String(v),'hex'));
 }catch{configured.clear();}}
 const limit=createRateLimiter({windowMs:60_000,max:30,maxConcurrent:4,maxEntries:projectIds.size});
 function authorize(project:string,authorization:unknown,origin:unknown){
  if(!configured.has(project)||!model)fail('PROJECT_AI_NOT_CONFIGURED',404);
  // This is explicitly a backend-to-backend API. Never enable browser CORS.
  if(origin!==undefined)fail('PROJECT_AI_SERVER_ONLY',403);
  if(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9_-]{43,128}$/.test(authorization))fail('PROJECT_AI_AUTH_REQUIRED',401);
  const supplied=createHash('sha256').update((authorization as string).slice(7)).digest();
  if(!timingSafeEqual(supplied,configured.get(project)!))fail('PROJECT_AI_AUTH_REQUIRED',401);
  const decision=limit.check(project);if(!decision.ok)fail('PROJECT_AI_RATE_LIMITED',429);
  return decision as {ok:true;release:()=>void};
 }
 async function text(project:string,input:unknown,signal?:AbortSignal){
  signal?.throwIfAborted();
  if(!configured.has(project)||!model)fail('PROJECT_AI_NOT_CONFIGURED',404);
  const args=obj(input);
  if(Object.keys(args).some(k=>!['text','task'].includes(k))||typeof args.text!=='string'||!args.text.trim()||args.text.length>12000||containsPlaintextCredential(args.text))fail('PROJECT_AI_INVALID_INPUT');
  const task=args.task??'answer';
  if(!['answer','summarize','rewrite','classify'].includes(String(task)))fail('PROJECT_AI_INVALID_TASK');
  const guidance={answer:'Soruyu yanıtla.',summarize:'Metni özetle.',rewrite:'Metni açık ve akıcı Türkçeyle yeniden yaz.',classify:'Metnin konusunu sınıflandır ve gerekçeyi belirt.'}[String(task) as 'answer'|'summarize'|'rewrite'|'classify'];
  try{
   const result=await complete({model,stream:false,max_tokens:2048,temperature:0.2,messages:[{role:'system',content:'Bu yalnız metin işleme API hizmetidir. '+guidance+' Araç, hesap, gizli anahtar veya dış işlem yetkin yok. Kaynakta olmayan bilgi uydurma.'},{role:'user',content:args.text}]},signal);
   const rows=obj(result).choices;
   const answer=Array.isArray(rows)&&rows.length?obj(obj(rows[0]).message).content:null;
   if(typeof answer!=='string'||!answer.trim()||answer.length>32000||containsPlaintextCredential(answer))fail('PROJECT_AI_INVALID_RESPONSE',502);
   return {project,task,text:(answer as string).trim(),model:completionOrigin(result)??null,toolsExecuted:false};
  }catch(error){if(signal?.aborted)throw error;const status=Number((error as {status?:unknown})?.status);return fail(status===429?'PROJECT_AI_UPSTREAM_LIMIT':'PROJECT_AI_UPSTREAM_FAILED',status===429?429:502);}
 }
 return Object.freeze({authorize,text,status:()=>({configuredProjects:configured.size,enabled:Boolean(configured.size&&model)})});
}
