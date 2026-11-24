
import type { DatabaseSync } from 'node:sqlite';
import type { createModelLab } from './model-lab.ts';
export const DAY_MS=24*60*60*1000;
export type ExpertHealth={agentId:string;healthy:boolean;reasons:string[];successRate:number|null;p99Ms:number|null;sampleCount:number};
type DailyReport={startedAt:string;finishedAt:string|null;state:'running'|'completed'|'partial'|'failed';experts:ExpertHealth[];liveProbes:boolean;testedModels:string[];specialists:string[];taskLeaders:Record<string,string[]>;error:string|null};
export function createDailyImprovement({db,lab,expertHealth,liveProbes=false,enabled=true,now=Date.now}:{db:DatabaseSync;lab:ReturnType<typeof createModelLab>|null;expertHealth:()=>ExpertHealth[];liveProbes?:boolean;enabled?:boolean;now?:()=>number}){
  db.exec('CREATE TABLE IF NOT EXISTS hafize_daily_improvement (id INTEGER PRIMARY KEY CHECK(id=1), started_at INTEGER NOT NULL, report TEXT NOT NULL)');
  let inFlight:Promise<DailyReport|null>|null=null;
  let controller:AbortController|null=null;
  let stopped=false;
  const read=()=>db.prepare('SELECT started_at, report FROM hafize_daily_improvement WHERE id=1').get() as {started_at:number;report:string}|undefined;
  function status(){
    const row=read();let report:DailyReport|null=null;
    try{if(row)report=JSON.parse(row.report);}catch{}
    return {enabled,liveProbes,intervalHours:24,nextDueAt:row?new Date(row.started_at+DAY_MS).toISOString():null,running:Boolean(inFlight),report};
  }
  async function execute():Promise<DailyReport|null>{
    if(!enabled||stopped)return null;
    const started=now();
    const previous=read();
    if(previous&&started-previous.started_at<DAY_MS)return null;
    if(liveProbes&&lab?.status().running)return null;
    const report:DailyReport={startedAt:new Date(started).toISOString(),finishedAt:null,state:'running',experts:[],liveProbes,testedModels:[],specialists:[],taskLeaders:{},error:null};
    // Atomic claim prevents concurrent cycles on a shared SQLite database.
    const claim=db.prepare('INSERT INTO hafize_daily_improvement(id,started_at,report) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET started_at=excluded.started_at,report=excluded.report WHERE hafize_daily_improvement.started_at<=?').run(started,JSON.stringify(report),started-DAY_MS);
    if(!claim.changes)return null;
    controller=new AbortController();
    try{
      report.experts=expertHealth();
      if(liveProbes&&lab){
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(180000)]);
        const batch=await lab.batch(signal);
        report.testedModels=batch.completed.map(row=>row.model);
        const snapshot=lab.status();
        const specialist=snapshot.specialists.find(id=>!snapshot.specialistResults.some(row=>row.model===id&&started-Date.parse(row.testedAt)<DAY_MS));
        if(specialist&&!snapshot.blockedUntil&&snapshot.requestsRemaining>0){
          const result=await lab.specialistProbe(specialist,signal);
          report.specialists.push(result.model);
          if(result.status!=='passed')report.error='SPECIALIST_PROBE_'+result.status;
        }
        if(batch.paused||batch.completed.some(row=>row.status!=='passed'||row.toolProbeStatus!=='passed'))report.error=report.error||'MODEL_TEST_PARTIAL';
      }else if(liveProbes&&!lab)report.error='MODEL_LAB_UNAVAILABLE';
      report.taskLeaders=lab?.status().taskLeaders??{};
      report.state=report.error?'partial':'completed';
    }catch(error){report.state='partial';report.error=error instanceof Error&&/^MODEL_LAB_[A-Z0-9_]+$/.test(error.message)?error.message:'DAILY_IMPROVEMENT_INTERRUPTED';}
    finally{report.finishedAt=new Date(now()).toISOString();controller=null;db.prepare('UPDATE hafize_daily_improvement SET report=? WHERE id=1 AND started_at=?').run(JSON.stringify(report),started);}
    return report;
  }
  function tick(){if(inFlight)return inFlight;inFlight=execute().finally(()=>{inFlight=null;});return inFlight;}
  function stop(){stopped=true;controller?.abort();return inFlight?.then(()=>undefined)??Promise.resolve();}
  return {tick,status,stop};
}
