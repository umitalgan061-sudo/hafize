import type {DatabaseSync} from 'node:sqlite';
import type {createModelLab} from './model-lab.ts';
import {KIMI_K31_PRO} from './model-lab-provider-profile.ts';
/** Explicit operator-only, short-lived deployment smoke check. No HTTP trigger or secret output. */
export async function deploymentKimiProbe({db,lab,until,now=Date.now,log=console.log}:{db:DatabaseSync;lab:ReturnType<typeof createModelLab>|null;until?:string;now?:()=>number;log?:(line:string)=>void}){
 if(!until||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(until))return;
 const expiry=Date.parse(until),started=now();
 if(!Number.isFinite(expiry)||expiry<=started||expiry-started>10*60_000)return;
 const prefix='hafize.deploy_kimi_probe ';
 const emit=(value:Record<string,unknown>)=>log(prefix+JSON.stringify({model:KIMI_K31_PRO,...value}));
 db.exec('CREATE TABLE IF NOT EXISTS hafize_deploy_kimi_probe(until TEXT PRIMARY KEY)');
 const claim=db.prepare('INSERT OR IGNORE INTO hafize_deploy_kimi_probe(until) VALUES(?)').run(until);
 if(!claim.changes)return;
 if(!lab){emit({state:'unavailable',reason:'NVIDIA_LAB_UNAVAILABLE'});return;}
 try{
  const row=await lab.probe(KIMI_K31_PRO,AbortSignal.timeout(Math.max(1,Math.min(190_000,expiry-started))));
  emit({state:'result',testedAt:row.testedAt,fresh:Date.parse(row.testedAt)>=started,status:row.status,chat:row.chat,tools:row.tools,toolProbeStatus:row.toolProbeStatus,requests:row.requests,latencyMs:row.latencyMs,turkish:row.turkish,reasoning:row.reasoning,coding:row.coding});
 }catch(error){const code=error instanceof Error&&/^MODEL_LAB_[A-Z0-9_]+$/.test(error.message)?error.message:'DEPLOY_PROBE_FAILED';emit({state:'failed',reason:code});}
}
