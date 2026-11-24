
import type { DatabaseSync } from 'node:sqlite';
import type { createModelLab } from './model-lab.ts';
export const DAY_MS=24*60*60*1000;
export type ExpertHealth={agentId:string;healthy:boolean;reasons:string[];successRate:number|null;p99Ms:number|null;sampleCount:number};
type DailyReport={changes?:{kind:string;before:string|null;after:string|null}[];startedAt:string;finishedAt:string|null;state:'running'|'completed'|'partial'|'failed';experts:ExpertHealth[];liveProbes:boolean;testedModels:string[];specialists:string[];taskLeaders:Record<string,string[]>;error:string|null};
export function createDailyImprovement({db,lab,expertHealth,liveProbes=false,enabled=true,now=Date.now}:{db:DatabaseSync;lab:ReturnType<typeof createModelLab>|null;expertHealth:()=>ExpertHealth[];liveProbes?:boolean;enabled?:boolean;now?:()=>number}){
  db.exec('CREATE TABLE IF NOT EXISTS hafize_daily_improvement (id INTEGER PRIMARY KEY CHECK(id=1), started_at INTEGER NOT NULL, report TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS hafize_daily_improvement_history (started_at INTEGER PRIMARY KEY, report TEXT NOT NULL)');
  let inFlight:Promise<DailyReport|null>|null=null;
  let controller:AbortController|null=null;
  let stopped=false;
  const read=()=>db.prepare('SELECT started_at, report FROM hafize_daily_improvement WHERE id=1').get() as {started_at:number;report:string}|undefined;
  function status(){
    const row=read();let report:DailyReport|null=null;
    try{if(row)report=JSON.parse(row.report);}catch{}
    const history=(db.prepare('SELECT report FROM hafize_daily_improvement_history ORDER BY started_at DESC LIMIT 14').all() as {report:string}[]).flatMap(row=>{try{const item=JSON.parse(row.report) as DailyReport;return [{startedAt:item.startedAt,finishedAt:item.finishedAt,state:item.state,testedModels:item.testedModels.length,specialists:item.specialists.length,changes:item.changes??[]}];}catch{return [];}});
    return {enabled,liveProbes,history,intervalHours:24,nextDueAt:row?new Date(row.started_at+DAY_MS).toISOString():null,running:Boolean(inFlight),report};
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
        const age=(id:string)=>Date.parse(snapshot.specialistResults.find(row=>row.model===id)?.testedAt||'')||0;
        const specialist=[...snapshot.specialists].sort((a,b)=>age(a)-age(b)).find(id=>started-age(id)>=DAY_MS||!snapshot.specialistResults.some(row=>row.model===id));
        if(specialist&&!snapshot.blockedUntil&&snapshot.requestsRemaining>0){
          const result=await lab.specialistProbe(specialist,signal);
          report.specialists.push(result.model);
          if(result.status!=='passed')report.error='SPECIALIST_PROBE_'+result.status;
        }
        if(batch.paused||batch.completed.some(row=>row.status!=='passed'||row.toolProbeStatus!=='passed'))report.error=report.error||'MODEL_TEST_PARTIAL';
      }else if(liveProbes&&!lab)report.error='MODEL_LAB_UNAVAILABLE';
      report.taskLeaders=lab?.status().taskLeaders??{};
      let before:Record<string,string[]>={};try{if(previous)before=(JSON.parse(previous.report) as DailyReport).taskLeaders||{};}catch{}
      report.changes=Object.entries(report.taskLeaders).flatMap(([kind,ids])=>{const old=before[kind]?.[0]??null;const next=ids[0]??null;return old===next?[]:[{kind,before:old,after:next}];});
      report.state=report.error?'partial':'completed';
    }catch(error){report.state='partial';report.error=error instanceof Error&&/^MODEL_LAB_[A-Z0-9_]+$/.test(error.message)?error.message:'DAILY_IMPROVEMENT_INTERRUPTED';}
    finally{report.finishedAt=new Date(now()).toISOString();controller=null;const payload=JSON.stringify(report);db.prepare('UPDATE hafize_daily_improvement SET report=? WHERE id=1 AND started_at=?').run(payload,started);db.prepare('INSERT OR REPLACE INTO hafize_daily_improvement_history(started_at,report) VALUES(?,?)').run(started,payload);db.exec('DELETE FROM hafize_daily_improvement_history WHERE started_at NOT IN (SELECT started_at FROM hafize_daily_improvement_history ORDER BY started_at DESC LIMIT 14)');}
    return report;
  }
  function tick(){if(inFlight)return inFlight;inFlight=execute().finally(()=>{inFlight=null;});return inFlight;}
  function stop(){stopped=true;controller?.abort();return inFlight?.then(()=>undefined)??Promise.resolve();}
  return {tick,status,stop};
}
