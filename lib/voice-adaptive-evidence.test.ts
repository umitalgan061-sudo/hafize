import {describe,it,expect} from 'vitest';
import {openHafizeDb} from './hafize-db.ts';
import {createRuntimeEvidence} from './model-runtime-evidence.ts';
import {createModelRouter} from './model-router.ts';
import {createDailyImprovement} from './daily-improvement.ts';
describe('adaptive voice evidence',()=>{
 it('learns only from recent voice outcomes, preserves unknown candidates and expires evidence',()=>{
  const db=openHafizeDb(':memory:');let now=100000000;
  const a=createRuntimeEvidence(db,['slow','fast','unknown'],()=>now,'voice');
  const general=createRuntimeEvidence(db,['slow','fast'],()=>now);
  for(let i=0;i<8;i++){a.record({model:'slow',outcome:'headers_ok',latencyMs:3000});a.record({model:'fast',outcome:'headers_ok',latencyMs:500});}
  expect(a.reorderVoice(['slow','unknown','fast'])).toEqual(['fast','unknown','slow']);
  expect(general.summary()).toEqual([]);
  expect(createRuntimeEvidence(db,['slow','fast'],()=>now,'voice').reorderVoice(['slow','fast'])).toEqual(['fast','slow']);
  now+=86400000;expect(a.reorderVoice(['slow','fast'])).toEqual(['slow','fast']);db.close();
 });
 it('prefers reliable measured candidates but does not promote unknown model IDs',()=>{
  const db=openHafizeDb(':memory:');const a=createRuntimeEvidence(db,['a','b'],Date.now,'voice');
  for(let i=0;i<8;i++){a.record({model:'a',outcome:i<3?'slow':'headers_ok',latencyMs:100});a.record({model:'b',outcome:'headers_ok',latencyMs:900});}
  a.record({model:'injected',outcome:'headers_ok',latencyMs:1});
  expect(a.reorderVoice(['a','b'])).toEqual(['b','a']);expect(a.summary().map(x=>x.model)).toEqual(['a','b']);db.close();
 });
 it('applies learning only to voice, rejects injected rankings and labels measured lane',async()=>{
  const calls:string[]=[],events:any[]=[];
  const router=createModelRouter({chain:['huge','lightning','flash'],keepFirst:['lightning'],preferVoice:ids=>[...ids].reverse(),observeAttempt:e=>events.push(e),log:()=>{}});
  const send=async(body:string)=>{calls.push(JSON.parse(body).model);return new Response('data: {"choices":[{"delta":{"content":"Selam"}}]}\n\ndata: [DONE]\n\n');};
  const body=JSON.stringify({model:'lightning',stream:true});
  await (await router.send(body,send,undefined,undefined,true)).text();await router.send(body,send);
  expect(calls).toEqual(['flash','lightning']);expect(events[0].lane).toBe('voice');expect(events[1].lane).toBeUndefined();
  const guarded=createModelRouter({chain:['lightning','flash'],preferVoice:()=>['foreign','flash'],log:()=>{}});
  calls.length=0;await (await guarded.send(body,send,undefined,undefined,true)).text();expect(calls).toEqual(['lightning']);
 });
 it('includes actual expert and voice evidence in the daily improvement plan',async()=>{
  const db=openHafizeDb(':memory:');
  const daily=createDailyImprovement({db,lab:null,expertHealth:()=>[{agentId:'expert-test',healthy:false,reasons:['latency'],sampleCount:8,successRate:.75,p99Ms:5000}],voiceEvidence:()=>[{model:'fast',attempts:10,headersOk:7,failures:3,streamFailures:0,meanHeaderMs:4000}]});
  const report=await daily.tick();expect(report?.voiceEvidence?.length).toBe(1);expect(report?.plan?.tasks.map(x=>x.id)).toContain('voice:fast');expect(report?.plan?.tasks.map(x=>x.id)).toContain('expert-health:expert-test');db.close();
 });
});
