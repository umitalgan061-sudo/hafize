import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { createContextCompactor, estimateMessageTokens } from './context-compaction.ts';

describe('context compaction',()=>{
  it('estimates tokens deterministically',()=>{
    expect(estimateMessageTokens([{role:'user',content:'1234'}])).toBe(4);
  });
  it('keeps short histories unchanged',async()=>{
    const compactor=createContextCompactor({contextLimitTokens:16_000,summarize:async()=> 'unused'});
    const messages=[{role:'system',content:'system'},{role:'user',content:'hello'}];
    const result=await compactor.prepare(messages,{model:'m'});
    expect(result.messages).toBe(messages);
    expect(result.meta.compacted).toBe(false);
  });
  it('preserves system and recent context',async()=>{
    const compactor=createContextCompactor({contextLimitTokens:16_000,triggerRatio:.5,preserveRecentMessages:4,summarize:async({messageCount})=>'old:'+messageCount});
    const messages=[{role:'system',content:'stable system'},...Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',content:'message '.repeat(300)+i}))];
    const result=await compactor.prepare(messages,{model:'m'});
    expect(result.meta.compacted).toBe(true);
    expect(result.messages[0]?.role).toBe('system');
    expect(result.messages.at(-1)?.content).toContain('19');
  });
  it('fails closed when summarization errors',async()=>{
    const compactor=createContextCompactor({contextLimitTokens:16_000,triggerRatio:.5,summarize:async()=>{throw new Error('provider');}});
    const messages=Array.from({length:30},()=>({role:'user',content:'x'.repeat(1000)}));
    const result=await compactor.prepare(messages);
    expect(result.meta.reason).toBe('summary_failed');
    expect(result.messages).toBe(messages);
  });
});

it('a long paste leaves room for earlier requirements and later corrections',async()=>{
 let source='';
 const engine=createContextCompactor({contextLimitTokens:16000,triggerRatio:0.5,preserveRecentMessages:4,maxSummarySourceChars:4000,summarize:async req=>(source=req.source,'özet')});
 const history=[{role:'user',content:'İstenen çıktı GeoJSON.'},{role:'assistant',content:'başlangıç '+'a'.repeat(12000)+' son değer'},{role:'user',content:'Düzeltme: koordinatlar EPSG:4326.'},...Array.from({length:4},()=>({role:'user',content:'son tur'}))];
 const result=await engine.prepare(history);
 assert.equal(result.meta.compacted,true);
 for(const value of ['GeoJSON','başlangıç','son değer','EPSG:4326'])assert.ok(source.includes(value));
 assert.ok(source.length<=4000);
 assert.deepEqual(result.messages.slice(-4),history.slice(-4));
});
it('counts text inside structured messages',()=>{
 assert.equal(estimateMessageTokens([{content:[{type:'text',text:'merhaba'}]}]),7);
});