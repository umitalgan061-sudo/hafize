import { describe, expect, it, vi } from 'vitest';
import { createLocalModelProvider } from './local-model-provider.ts';

describe('local model provider',()=>{
  it('restricts the base URL to loopback',()=>{
    expect(()=>createLocalModelProvider({baseUrl:'https://example.com'})).toThrow('INVALID_LOCAL_PROVIDER:baseUrl');
    expect(()=>createLocalModelProvider({baseUrl:'ftp://127.0.0.1:11434'})).toThrow('INVALID_LOCAL_PROVIDER:baseUrl');
  });
  it('normalizes a successful local completion',async()=>{
    const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({model:'qwen',message:{role:'assistant',content:'ok'}}),{status:200}));
    const provider=createLocalModelProvider({baseUrl:'http://127.0.0.1:11434',fetchImpl});
    const result=await provider.complete({model:'qwen',messages:[{role:'user',content:'hi'}]});
    expect(result).toMatchObject({object:'chat.completion',model:'qwen'});
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it('rejects unknown request fields',async()=>{
    const provider=createLocalModelProvider({fetchImpl:async()=>new Response('{}')});
    await expect(provider.complete({model:'qwen',messages:[{role:'user',content:'x'}],unexpected:true})).rejects.toThrow('INVALID_LOCAL_PROVIDER:payload.field');
  });
});
