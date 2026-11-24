import type {DatabaseSync} from 'node:sqlite';
const HOUR=3600000;
export type RuntimeAttempt={model:string;outcome:'headers_ok'|'provider_failure'|'slow'|'stream_failure';latencyMs:number};
export type RuntimeEvidence={model:string;attempts:number;headersOk:number;failures:number;streamFailures:number;meanHeaderMs:number|null};
export function createRuntimeEvidence(db:DatabaseSync,allowed:readonly string[],now=Date.now){
 const permitted=new Set(allowed);
 db.exec('CREATE TABLE IF NOT EXISTS hafize_runtime_evidence (model TEXT NOT NULL, hour INTEGER NOT NULL, ok INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, stream_failures INTEGER NOT NULL DEFAULT 0, latency INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(model,hour))');
 const insert=db.prepare('INSERT INTO hafize_runtime_evidence(model,hour,ok,failures,stream_failures,latency) VALUES(?,?,?,?,?,?) ON CONFLICT(model,hour) DO UPDATE SET ok=ok+excluded.ok,failures=failures+excluded.failures,stream_failures=stream_failures+excluded.stream_failures,latency=latency+excluded.latency');
 function record(event:RuntimeAttempt){
  if(!permitted.has(event.model)||!Number.isFinite(event.latencyMs))return;
  const ok=event.outcome==='headers_ok'?1:0;
  const stream=event.outcome==='stream_failure'?1:0;
  insert.run(event.model,Math.floor(now()/HOUR),ok,ok||stream?0:1,stream,ok?Math.max(0,Math.min(90000,Math.round(event.latencyMs))):0);
 }
 function summary():RuntimeEvidence[]{
  const hour=Math.floor(now()/HOUR);
  const rows=db.prepare('SELECT model,SUM(ok) AS ok,SUM(failures) AS failures,SUM(stream_failures) AS streams,SUM(latency) AS latency FROM hafize_runtime_evidence WHERE hour>? AND hour<=? GROUP BY model ORDER BY model').all(hour-24,hour) as {model:string;ok:number;failures:number;streams:number;latency:number}[];
  return rows.filter(r=>permitted.has(r.model)).map(r=>({model:r.model,attempts:r.ok+r.failures,headersOk:r.ok,failures:r.failures,streamFailures:r.streams,meanHeaderMs:r.ok?Math.round(r.latency/r.ok):null}));
 }
 function reorder(verified:readonly string[]):string[]{
  const rows=new Map(summary().map(r=>[r.model,r]));
  // Never promote an unverified model. With enough evidence move unreliable candidates
  // behind their verified peers, preserving benchmark order within both groups.
  const degraded=(model:string)=>{const r=rows.get(model);return Boolean(r&&r.attempts>=8&&(r.failures+Math.min(r.streamFailures,r.headersOk))/r.attempts>=0.25);};
  return [...verified.filter(m=>!degraded(m)),...verified.filter(degraded)];
 }
 function prune(){db.prepare('DELETE FROM hafize_runtime_evidence WHERE hour<?').run(Math.floor(now()/HOUR)-24*14);}
 return {record,summary,reorder,prune};
}
