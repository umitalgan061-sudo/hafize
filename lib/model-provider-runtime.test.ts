import { describe, expect, it } from 'vitest';
import { createModelProviderRuntime } from './model-provider-runtime.ts';

describe('model provider runtime',()=>{
  it('defaults local provider to disabled',()=>{
    const runtime=createModelProviderRuntime({env:{HAFIZE_LOCAL_MODEL_ENABLED:''},nvidiaComplete:async()=>({ok:true})});
    expect(runtime.publicStatus()).toEqual({defaultProvider:'nvidia',localEnabled:false});
    expect(runtime.resolve(undefined)).toBe('nvidia');
  });
  it('accepts explicit local enablement',()=>{
    const runtime=createModelProviderRuntime({
      env:{HAFIZE_LOCAL_MODEL_ENABLED:'true',HAFIZE_LOCAL_MODEL_BASE_URL:'http://127.0.0.1:11434'},
      nvidiaComplete:async()=>({source:'nvidia'}),
      fetchImpl:async()=>new Response(JSON.stringify({message:{role:'assistant',content:'local'}}))
    });
    expect(runtime.publicStatus().localEnabled).toBe(true);
    expect(runtime.resolve('local')).toBe('local');
  });
});
