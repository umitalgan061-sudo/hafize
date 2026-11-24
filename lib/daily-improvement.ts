import {buildEvolutionPlan,type EvolutionPlan} from './evolution-plan.ts';
import type {ExpertReadiness} from './expert-readiness.ts';
import type {RuntimeEvidence} from './model-runtime-evidence.ts';

import type { DatabaseSync } from 'node:sqlite';
import type { createModelLab } from './model-lab.ts';
export const DAY_MS=24*60*60*1000;
export type ExpertHealth={agentId:string;healthy:boolean;reasons:string[];successRate:number|null;p99Ms:number|null;sampleCount:number};
type DailyReport={plan?:EvolutionPlan;catalogDiscovery?:boolean;catalogChanges?:{addedCount:number;removedCount:number|null;added:string[];removed:string[]}|null;expertReadiness?:ExpertReadiness[];runtimeEvidence?:RuntimeEvidence[];deepTestedModels?:string[];warnings?:string[];changes?:{kind:string;before:string|null;after:string|null}[];startedAt:string;finishedAt:string|null;state:'running'|'completed'|'partial'|'failed';experts:ExpertHealth[];liveProbes:boolean;testedModels:string[];specialists:string[];taskLeaders:Record<string,string[]>;error:string|null};
/** Safe aggregate for host logs. Never include user text, credentials, or raw provider errors. */
export function dailyCycleSummary(report:DailyReport){return {state:report.state,startedAt:report.startedAt,finishedAt:report.finishedAt,experts:report.experts.length,contractChecks:report.expertReadiness?.length??0,contractsPassed:report.expertReadiness?.filter(r=>r.passed).length??0,liveProbes:report.liveProbes,catalogDiscovery:report.catalogDiscovery===true,testedModels:report.testedModels.length,deepTestedModels:report.deepTestedModels?.length??0,specialists:report.specialists.length,recommendations:report.plan?.tasks.length??0};}
export function createDailyImprovement({db,lab,expertHealth,expertReadiness=()=>[],runtimeEvidence=()=>[],adaptLeaders=ids=>[...ids],discoverCatalog=false,liveProbes=false,enabled=true,now=Date.now}:{db:DatabaseSync;lab:ReturnType<typeof createModelLab>|null;expertHealth:()=>ExpertHealth[];expertReadiness?:()=>ExpertReadiness[];runtimeEvidence?:()=>RuntimeEvidence[];adaptLeaders?:(ids:readonly string[])=>string[];discoverCatalog?:boolean;liveProbes?:boolean;enabled?:boolean;now?:()=>number}){
  db.exec('CREATE TABLE IF NOT EXISTS hafize_daily_improvement (id INTEGER PRIMARY KEY CHECK(id=1), started_at INTEGER NOT NULL, report TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS hafize_daily_improvement_history (started_at INTEGER PRIMARY KEY, report TEXT NOT NULL)');
  let inFlight:Promise<DailyReport|null>|null=null;
  let controller:AbortController|null=null;
  let stopped=false;
  const read=()=>db.prepare('SELECT started_at, report FROM hafize_daily_improvement WHERE id=1').get() as {started_at:number;report:string}|undefined;
  function finalize(started:number,report:DailyReport,expected:string){
    const payload=JSON.stringify(report);
    db.exec('BEGIN IMMEDIATE');try{
      const updated=db.prepare('UPDATE hafize_daily_improvement SET report=? WHERE id=1 AND started_at=? AND report=?').run(payload,started,expected);
      if(updated.changes)db.prepare('INSERT OR REPLACE INTO hafize_daily_improvement_history(started_at,report) VALUES(?,?)').run(started,payload);
      db.exec('DELETE FROM hafize_daily_improvement_history WHERE started_at NOT IN (SELECT started_at FROM hafize_daily_improvement_history ORDER BY started_at DESC LIMIT 14)');db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  function recoverInterrupted(){const row=read();if(!row||now()-row.started_at<=240000)return;let report:DailyReport;try{report=JSON.parse(row.report);}catch{return;}if(report.state!=='running')return;finalize(row.started_at,{...report,state:'partial',finishedAt:new Date(now()).toISOString(),error:'DAILY_INTERRUPTED_BEFORE_REPORT'},row.report);}
  function status(){
    const row=read();let report:DailyReport|null=null;
    try{if(row)report=JSON.parse(row.report);}catch{}
    const history=(db.prepare('SELECT report FROM hafize_daily_improvement_history ORDER BY started_at DESC LIMIT 14').all() as {report:string}[]).flatMap(row=>{try{const item=JSON.parse(row.report) as DailyReport;return [{startedAt:item.startedAt,finishedAt:item.finishedAt,state:item.state,testedModels:item.testedModels.length,deepTestedModels:item.deepTestedModels?.length??0,specialists:item.specialists.length,changes:item.changes??[]}];}catch{return [];}});
    if(report?.state==='running'&&!inFlight&&row&&now()-row.started_at>240000)report={...report,state:'partial',error:'DAILY_INTERRUPTED_BEFORE_REPORT'};
    return {enabled,liveProbes,discoverCatalog,history,intervalHours:24,nextDueAt:row?new Date(row.started_at+DAY_MS).toISOString():null,running:Boolean(inFlight),report};
  }
  async function execute():Promise<DailyReport|null>{
    if(!enabled||stopped)return null;
    recoverInterrupted();
    const started=now();
    const previous=read();
    if(previous&&started-previous.started_at<DAY_MS)return null;
    if(liveProbes&&lab?.status().running)return null;
    const report:DailyReport={startedAt:new Date(started).toISOString(),finishedAt:null,state:'running',experts:[],liveProbes,testedModels:[],specialists:[],taskLeaders:{},error:null};
    // Atomic claim prevents concurrent cycles on a shared SQLite database.
    const claimedReport=JSON.stringify(report);
    const claim=db.prepare('INSERT INTO hafize_daily_improvement(id,started_at,report) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET started_at=excluded.started_at,report=excluded.report WHERE hafize_daily_improvement.started_at<=?').run(started,claimedReport,started-DAY_MS);
    if(!claim.changes)return null;
    controller=new AbortController();
    try{
      report.experts=expertHealth();
      report.expertReadiness=expertReadiness();
      if(report.expertReadiness.some(row=>!row.passed))report.error='EXPERT_CONTRACT_CHECK_FAILED';
      report.runtimeEvidence=runtimeEvidence();
      // Catalog refresh is optional and consumes one of the existing five daily requests.
      let catalogCall=false;
      if(discoverCatalog&&lab&&!lab.status().blockedUntil&&lab.status().requestsRemaining>0){
        const last=lab.status().catalog?.listedAt;
        if(!last||started-Date.parse(last)>=2*DAY_MS){catalogCall=true;try{await lab.discover(AbortSignal.any([controller.signal,AbortSignal.timeout(35000)]));report.catalogDiscovery=true;report.catalogChanges=lab.status().catalogDelta;}catch{report.error=report.error||'CATALOG_DISCOVERY_FAILED';}}
      }
      if(liveProbes&&lab){
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(180000)]);
        const initial=lab.status();
        let deepCandidate:string|undefined=initial.deepPendingModels?.[0];
        let lastWasDeep=false;
        try{if(previous)lastWasDeep=Boolean((JSON.parse(previous.report) as DailyReport).deepTestedModels?.length);}catch{}
        const reserveDeep=!lastWasDeep&&initial.eligible.length>=2&&!initial.blockedUntil&&initial.requestsRemaining>=4;
        report.deepTestedModels=[];
        report.warnings=[];
        let batchLimit=reserveDeep?1:2;
        if(deepCandidate&&reserveDeep){
          batchLimit=1;
          const deep=await lab.deepProbe(deepCandidate,signal);
          report.deepTestedModels.push(deep.model);
          if(deep.status!=='passed'||!deep.language||!deep.reasoning||!deep.coding||!deep.toolFollowup)report.warnings.push('DEEP_TEST_QUALITY_CHECK:'+deep.model);
        }
        const batch=await lab.batch(signal,undefined,batchLimit);
        report.testedModels=batch.completed.map(row=>row.model);
        // A newly smoke-tested candidate may be the only current candidate after 24h expiry.
        const afterBatch=lab.status();
        if(reserveDeep&&!report.deepTestedModels.length&&!afterBatch.blockedUntil&&afterBatch.requestsRemaining>=2){
          deepCandidate=batch.completed.find(row=>row.chat&&row.tools)?.model;
          if(deepCandidate){const deep=await lab.deepProbe(deepCandidate,signal);report.deepTestedModels.push(deep.model);if(deep.status!=='passed'||!deep.language||!deep.reasoning||!deep.coding||!deep.toolFollowup)report.warnings.push('DEEP_TEST_QUALITY_CHECK:'+deep.model);}
        }
        const snapshot=lab.status();
        const age=(id:string)=>Date.parse(snapshot.specialistResults.find(row=>row.model===id)?.testedAt||'')||0;
        const specialist=[...snapshot.specialists].sort((a,b)=>age(a)-age(b)).find(id=>started-age(id)>=DAY_MS||!snapshot.specialistResults.some(row=>row.model===id));
        if(!catalogCall&&specialist&&!snapshot.blockedUntil&&snapshot.requestsRemaining>0){
          const result=await lab.specialistProbe(specialist,signal);
          report.specialists.push(result.model);
          if(result.status!=='passed')report.error=report.error||'SPECIALIST_PROBE_'+result.status;
        }
        if(batch.paused||batch.completed.some(row=>row.status!=='passed'||row.toolProbeStatus!=='passed'))report.error=report.error||'MODEL_TEST_PARTIAL';
      }else if(liveProbes&&!lab)report.error='MODEL_LAB_UNAVAILABLE';
      report.taskLeaders=Object.fromEntries(Object.entries(lab?.status().taskLeaders??{}).map(([kind,ids])=>[kind,adaptLeaders(ids)]));
      let before:Record<string,string[]>={};try{if(previous)before=(JSON.parse(previous.report) as DailyReport).taskLeaders||{};}catch{}
      report.changes=Object.entries(report.taskLeaders).flatMap(([kind,ids])=>{const old=before[kind]?.[0]??null;const next=ids[0]??null;return old===next?[]:[{kind,before:old,after:next}];});
      report.state=report.error||report.warnings?.length?'partial':'completed';
    }catch(error){report.state='partial';report.error=error instanceof Error&&/^MODEL_LAB_[A-Z0-9_]+$/.test(error.message)?error.message:'DAILY_IMPROVEMENT_INTERRUPTED';}
    finally{report.finishedAt=new Date(now()).toISOString();controller=null;report.plan=buildEvolutionPlan({now:started,readiness:report.expertReadiness??[],runtime:report.runtimeEvidence??[],catalogChanges:report.catalogChanges??null,pendingModels:lab?.status().pendingModels??[],labAvailable:Boolean(lab),liveProbes,error:report.error});finalize(started,report,claimedReport);}
    return report;
  }
  function tick(){if(inFlight)return inFlight;inFlight=execute().finally(()=>{inFlight=null;});return inFlight;}
  function stop(){stopped=true;controller?.abort();return inFlight?.then(()=>undefined)??Promise.resolve();}
  return {tick,status,stop};
}
