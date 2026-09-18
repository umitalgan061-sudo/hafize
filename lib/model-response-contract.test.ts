import { describe, expect, it } from 'vitest';
import { MODEL_RESPONSE_CONTRACT, normalizeModelResponse, normalizeNvidiaChatCompletion } from './model-response-contract.ts';

describe('model response contract',()=>{
  it('normalizes assistant output',()=>{
    const value=normalizeNvidiaChatCompletion({id:'r1',model:'m1',choices:[{finish_reason:'stop',message:{role:'assistant',content:'Merhaba',tool_calls:[]}}],usage:{total_tokens:7}});
    expect(value.content).toBe('Merhaba');
    expect(value.finishReason).toBe('stop');
    expect(value.usage?.total_tokens).toBe(7);
  });
  it('normalizes provider tool calls',()=>{
    const value=normalizeNvidiaChatCompletion({choices:[{message:{role:'assistant',content:'',tool_calls:[{id:'c1',function:{name:'runtime_status',arguments:'{}'}}]}}]});
    expect(value.toolCalls[0]).toEqual({id:'c1',name:'runtime_status',arguments:'{}'});
  });
  it('rejects oversized tool calls',()=>{
    expect(()=>normalizeModelResponse({toolCalls:[{id:'c1',name:'x',arguments:'x'.repeat(16_385)}]})).toThrow('INVALID_MODEL_TOOL_CALL');
  });
  it('rejects non assistant messages',()=>{
    expect(()=>normalizeNvidiaChatCompletion({choices:[{message:{role:'user',content:'x'}}]})).toThrow('INVALID_MODEL_RESPONSE');
  });
  it('exposes hard limits',()=>{
    expect(MODEL_RESPONSE_CONTRACT.maxToolCalls).toBe(16);
    expect(MODEL_RESPONSE_CONTRACT.maxToolArgumentLength).toBe(16_384);
  });
});
