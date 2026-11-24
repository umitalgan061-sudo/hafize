import {describe,expect,it,vi} from 'vitest';
import {createLocalNimProvider} from './local-nim-provider.ts';
import {createModelProviderRuntime} from './model-provider-runtime.ts';
const request={model:'meta/llama-3.1-8b-instruct',messages:[{role:'user',content:'Merhaba'}],stream:false,max_tokens:32};
const response=()=>Response.json({choices:[{message:{role:'assistant',content:'Merhaba!'},finish_reason:'stop'}]});
describe('local NIM inference',()=>{
  it('blocks remote and credential-bearing origins',()=>{
    for(const baseUrl of ['https://example.com','http://127.0.0.1@evil.test','http://localhost:8000/other','http://localhost:8000/?token=x','http://localhost:8000/#x'])expect(()=>createLocalNimProvider({baseUrl})).toThrow('INVALID_LOCAL_PROVIDER:baseUrl');
  });
  it('requires readiness then discovers slash-containing model IDs',async()=>{
    const fetchImpl=vi.fn(async (url:RequestInfo|URL)=>String(url).endsWith('/health/ready')?Response.json({status:'ready'}):Response.json({data:[{id:request.model},{id:request.model},{id:'bad id'}]}));
    const p=createLocalNimProvider({fetchImpl});
    expect(await p.models()).toEqual([request.model]);
    expect(fetchImpl.mock.calls.map(x=>String(x[0]))).toEqual(['http://127.0.0.1:8000/v1/health/ready','http://127.0.0.1:8000/v1/models']);
  });
  it('routes the actual local chat payload without leaking cloud credentials or using the cloud',async()=>{
    const cloud=vi.fn(async()=>({}));
    const fetchImpl=vi.fn(async (_url:RequestInfo|URL,_init?:RequestInit)=>response());
    const runtime=createModelProviderRuntime({env:{HAFIZE_LOCAL_MODEL_ENABLED:'true',HAFIZE_LOCAL_MODEL_PROTOCOL:'nim',NVIDIA_API_KEY:'secret-cloud-key'},nvidiaComplete:cloud,fetchImpl});
    expect(await runtime.complete({provider:'local',payload:request})).toMatchObject({provider:'local',result:{choices:[{message:{content:'Merhaba!'}}]}});
    const [url,init]=fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:8000/v1/chat/completions');
    expect(JSON.parse(String(init?.body))).toEqual(request);
    expect(init?.redirect).toBe('error');
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    expect(cloud).not.toHaveBeenCalled();
  });
  it('never falls back silently when NIM is down',async()=>{
    const cloud=vi.fn(async()=>({}));
    const runtime=createModelProviderRuntime({env:{HAFIZE_LOCAL_MODEL_ENABLED:'true',HAFIZE_LOCAL_MODEL_PROTOCOL:'nim'},nvidiaComplete:cloud,fetchImpl:async()=>new Response('',{status:503})});
    await expect(runtime.complete({provider:'local',payload:request})).rejects.toThrow('LOCAL_PROVIDER_ERROR');
    expect(cloud).not.toHaveBeenCalled();
  });
  it('rejects unsupported tools, streaming and invalid model identifiers',async()=>{
    const fetchImpl=vi.fn(async()=>response());
    const p=createLocalNimProvider({fetchImpl});
    for(const bad of [{...request,tools:[]},{...request,stream:true},{...request,model:'../bad'}])await expect(p.complete(bad)).rejects.toThrow('INVALID_LOCAL_PROVIDER');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('rejects empty assistant answers and malformed responses',async()=>{
    const p=createLocalNimProvider({fetchImpl:async()=>Response.json({choices:[{message:{role:'assistant',content:''}}]})});
    await expect(p.complete(request)).rejects.toThrow('INVALID_LOCAL_PROVIDER_RESPONSE');
  });
  it('does not list models on an unready container',async()=>{
    const fetchImpl=vi.fn(async()=>Response.json({status:'loading'}));
    await expect(createLocalNimProvider({fetchImpl}).models()).rejects.toThrow('LOCAL_PROVIDER_UNAVAILABLE');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
