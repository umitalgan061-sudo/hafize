import type {DatabaseSync} from 'node:sqlite';
import type {createModelLab} from './model-lab.ts';
import {GEMMA_4,OMNI} from './model-lab-provider-profile.ts';
const targets=[{model:GEMMA_4,kind:'text'},{model:OMNI,kind:'text'},{model:'nvidia/riva-translate-4b-instruct-v2',kind:'translation'},{model:'nvidia/nemotron-3.5-embed-1b',kind:'embedding'},{model:'nvidia/nemotron-3.5-embed-8b',kind:'embedding'}] as const;
/** Operator-requested, fixed synthetic suite. No arbitrary URLs, user content, response bodies or keys. */
export async function deploymentFreeModelProbe({db,lab,until,now=Date.now,log=console.log}:{db:DatabaseSync;lab:ReturnType<typeof createModelLab>|null;until?:string;now?:()=>number;log?:(line:string)=>void}){
 const started=now();
 if(!until||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(until))return;
 const expiry=Date.parse(until);
 if(!Number.isFinite(expiry)||expiry<=started||expiry-started>10*60_000)return;
 const emit=(row:Record<string,unknown>)=>log('hafize.deploy_free_model_probe '+JSON.stringify(row));
 db.exec('CREATE TABLE IF NOT EXISTS hafize_deploy_free_model_probe(until TEXT PRIMARY KEY)');
 if(!db.prepare('INSERT OR IGNORE INTO hafize_deploy_free_model_probe(until) VALUES(?)').run(until).changes)return;
 if(!lab){emit({state:'unavailable',reason:'NVIDIA_LAB_UNAVAILABLE'});return;}
 const signal=AbortSignal.timeout(Math.max(1,Math.min(195_000,expiry-started)));
 for(const target of targets){
   if(signal.aborted||lab.status().blockedUntil||lab.status().requestsRemaining<(target.kind==='text'?2:1)){emit({...target,state:'skipped',reason:'PROBE_BUDGET_OR_PROVIDER_PAUSE'});continue;}
   try{
    if(target.kind==='text'){const row=await lab.probe(target.model,signal);emit({...target,state:'result',status:row.status,testedAt:row.testedAt,fresh:Date.parse(row.testedAt)>=started,latencyMs:row.latencyMs,chat:row.chat,turkish:row.turkish,reasoning:row.reasoning,coding:row.coding,tools:row.toolProbeStatus,requests:row.requests});}
    else if(target.kind==='embedding'){const row=await lab.specialistProbe(target.model,signal);emit({...target,state:'result',status:row.status,testedAt:row.testedAt,fresh:Date.parse(row.testedAt)>=started,latencyMs:row.latencyMs,dimension:row.dimension,similarHigher:row.similarHigher});}
    else{const row=await lab.translationProbe(signal);emit({...target,state:'result',status:row.status,testedAt:row.testedAt,fresh:Date.parse(row.testedAt)>=started,latencyMs:row.latencyMs,translated:row.translated});}
   }catch(error){const reason=error instanceof Error&&/^MODEL_LAB_[A-Z0-9_]+$/.test(error.message)?error.message:'DEPLOY_PROBE_FAILED';emit({...target,state:'failed',reason});}
 }
 emit({state:'finished'});
}
