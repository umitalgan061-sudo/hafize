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
