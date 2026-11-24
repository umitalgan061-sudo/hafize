import type {DatabaseSync} from 'node:sqlite';
import type {createModelLab} from './model-lab.ts';
/** Short-lived operator-only check of new user-facing workflows. Synthetic inputs only. */
export async function deploymentBlueprintProbe({db,lab,until,now=Date.now,log=console.log}:{db:DatabaseSync;lab:ReturnType<typeof createModelLab>|null;until?:string;now?:()=>number;log?:(line:string)=>void}){
 const started=now();if(!until||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(until))return;
 const expiry=Date.parse(until);if(!Number.isFinite(expiry)||expiry<=started||expiry-started>600000)return;
 const emit=(row:Record<string,unknown>)=>log('hafize.deploy_blueprint_probe '+JSON.stringify(row));
 db.exec('CREATE TABLE IF NOT EXISTS hafize_deploy_blueprint_probe(until TEXT PRIMARY KEY)');if(!db.prepare('INSERT OR IGNORE INTO hafize_deploy_blueprint_probe(until) VALUES(?)').run(until).changes)return;
 if(!lab){emit({state:'unavailable'});return;}
 const signal=AbortSignal.timeout(Math.min(120000,expiry-started));
 const reason=(error:unknown)=>error instanceof Error&&/^MODEL_LAB_[A-Z0-9_]+$/.test(error.message)?error.message:'PROBE_FAILED';
 try{const row=await lab.translateText('Thank you.','en-tr',signal);emit({workflow:'riva_translation',state:/^(?:teşekkür(?:ler| ederim)|sağ ol(?:un)?)[.!]?$/iu.test(row.text)?'passed':'unexpected_output',model:row.model,latencyMs:row.latencyMs});}catch(error){emit({workflow:'riva_translation',state:'failed',reason:reason(error)});}
 try{if(signal.aborted)throw Error('MODEL_LAB_TIMEOUT');const row=await lab.semanticSearch('An apple is a fruit.\n\nAnkara is the capital of Türkiye.','What is the capital of Türkiye?','nvidia/nemotron-3.5-embed-1b',signal);emit({workflow:'semantic_retrieval',state:row.results[0]?.source===2?'passed':'unexpected_ranking',model:row.model,latencyMs:row.latencyMs,resultCount:row.results.length});}catch(error){emit({workflow:'semantic_retrieval',state:'failed',reason:reason(error)});}
 emit({state:'finished'});
}
