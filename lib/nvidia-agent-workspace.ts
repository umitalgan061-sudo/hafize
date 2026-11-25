import { BLUEPRINT_CATALOG, BLUEPRINT_META } from './nvidia-blueprint-catalog.ts';
import { PUBLIC_MODEL_CATALOG, PUBLIC_CATALOG_METADATA } from './nvidia-public-inventory.ts';
import { containsPlaintextCredential } from './plaintext-credential-policy.ts';
import type { createModelLab } from './model-lab.ts';

type Lab=ReturnType<typeof createModelLab>;
const fail=(code:string,status=400):never=>{throw Object.assign(new Error(code),{code,status});};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail('NVIDIA_WORKSPACE_INVALID_INPUT');
const nonempty=(v:unknown,n:number)=>typeof v==='string'&&v.trim()&&v.length<=n&&!containsPlaintextCredential(v)?v.trim():fail('NVIDIA_WORKSPACE_INVALID_TEXT');
const normalize=(s:string)=>s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'').replace(/ı/g,'i');
const keys:Record<string,readonly string[]>={status:['action','category'],blueprints:['action','category'],discover:['action'],probe:['action','model'],deep:['action','model'],embedding_probe:['action','model'],translation_probe:['action'],rerank_probe:['action'],rerank:['action','text','query'],comprehensive:['action'],audit_window:['action'],council:['action','text'],translate:['action','text','pair'],semantic_search:['action','text','query','model']};
/** No endpoints, credentials or arbitrary paths are accepted from a model. A catalog entry
 * is never proof of availability. Explicit source text must be present in the owner's
 * current request before sending it to the direct NVIDIA lab provider. */
export function createNvidiaAgentWorkspace({lab,ownerRequest,nimStatus}:{lab:Lab|null;ownerRequest:string;nimStatus:()=>unknown}){
 const request=ownerRequest.trim();
 const normalized=normalize(request);
 const externalAuthorized=/\bnvidia\b|\bnim\b|\briva\b|\bnemotron\b/.test(normalized)&&!/\b(?:kullanma|gonderme|calistirma|test etme)\b/.test(normalized);
 const probeAuthorized=externalAuthorized&&/\b(?:test|dene|dogrula|incele|calistir|kesfet|kontrol|gelistir)\b/.test(normalized);
 function trustedText(v:unknown,max:number){const text=nonempty(v,max);if(!externalAuthorized||!request.includes(text))fail('NVIDIA_WORKSPACE_SOURCE_NOT_AUTHORIZED',403);return text;}
 async function execute(raw:unknown,signal?:AbortSignal){
  const args=object(raw),action=typeof args.action==='string'?args.action:'';
  if(!Object.hasOwn(keys,action)||Object.keys(args).some(k=>!keys[action]!.includes(k)))fail('NVIDIA_WORKSPACE_INVALID_INPUT');
  signal?.throwIfAborted();
  const category=typeof args.category==='string'?args.category.trim().toLowerCase():'';
  if(action==='status'){
   const current=lab?.status();
   const rows=(current?.publicInventory??PUBLIC_MODEL_CATALOG.map(row=>({...row,configured:false,evidence:'untested',integration:'catalog_only',cost:'unknown'}))).filter(row=>!category||row.category===category);
   return {connected:Boolean(lab),metadata:PUBLIC_CATALOG_METADATA,models:rows,verifiedAgentModels:current?.verifiedAgentModels??[],taskLeaders:current?.taskLeaders??{},requestsRemaining:current?.requestsRemaining??null,blockedUntil:current?.blockedUntil??null,nim:nimStatus(),catalogIsNotExecutionProof:true};
  }
  if(action==='blueprints')return {metadata:BLUEPRINT_META,blueprints:BLUEPRINT_CATALOG.filter(row=>!category||row.area===category),note:'Yerel uyarlama veya ilgili özellik, resmi NVIDIA Blueprint dağıtımı değildir.'};
  if(!lab)fail('NVIDIA_WORKSPACE_NOT_CONFIGURED',503);
  try{
   if(action==='translate')return await lab!.translateText(trustedText(args.text,1000),args.pair,signal);
   if(action==='semantic_search')return await lab!.semanticSearch(trustedText(args.text,1400),trustedText(args.query,250),args.model,signal);
   if(action==='rerank')return await lab!.rankText(trustedText(args.text,14000),trustedText(args.query,1000),signal);
   if(action==='council')return await lab!.council(trustedText(args.text,1200),signal);
   if(!probeAuthorized)fail('NVIDIA_WORKSPACE_TEST_NOT_AUTHORIZED',403);
   if(action==='discover'){await lab!.discover(signal);return {catalog:lab!.status().catalog,listedIsNotAccessProof:true};}
   if(action==='probe')return await lab!.probe(nonempty(args.model,260),signal);
   if(action==='deep')return await lab!.deepProbe(nonempty(args.model,260),signal);
   if(action==='embedding_probe')return await lab!.specialistProbe(nonempty(args.model,260),signal);
   if(action==='rerank_probe')return await lab!.rerankProbe(signal);
   if(action==='translation_probe')return await lab!.translationProbe(signal);
   if(action==='comprehensive')return await lab!.comprehensive(signal);
   if(action==='audit_window')return await lab!.auditWindow(signal);
  }catch(error){
   if(signal?.aborted)throw error;
   const e=error as {code?:unknown;message?:unknown;status?:unknown};
   if(typeof e.code==='string'&&e.code.startsWith('NVIDIA_WORKSPACE_'))throw error;
   const code=typeof e.message==='string'&&/^MODEL_LAB_[A-Z0-9_]+$/.test(e.message)?e.message:'NVIDIA_WORKSPACE_EXECUTION_FAILED';
   fail(code,/BUDGET|BUSY|PAUSED|429/.test(code)?429:502);
  }
  return fail('NVIDIA_WORKSPACE_INVALID_INPUT');
 }
 return Object.freeze({execute});
}
