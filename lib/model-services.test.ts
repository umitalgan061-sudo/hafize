
import {describe,it,expect,vi} from 'vitest';
import {createModelServices} from './model-services.ts';
describe('embedding provider isolation',()=>{
  it('does not mix cached NVIDIA vectors and local vectors during failover',async()=>{
    let fail=false;
    const fetchImpl=vi.fn(async (url,init)=>{
      const body=JSON.parse(String(init?.body));
      if(String(url).includes('/api/embed')) return new Response(JSON.stringify({embeddings:body.input.map(()=>[8,9,10])}));
      if(fail)return new Response('',{status:503});
      return new Response(JSON.stringify({data:body.input.map((_,index)=>({index,embedding:[1,2]}))}));
    });
    const service=createModelServices({apiKey:'test',chat:async()=>({}),local:{enabled:true,baseUrl:'http://127.0.0.1:11434',embedModel:'test-local'},fetchImpl:fetchImpl as typeof fetch});
    expect(await service.embed(['same'])).toEqual({vectors:[[1,2]],model:'nvidia/nemotron-3-embed-1b'});
    fail=true;
    expect(await service.embed(['same','new'])).toEqual({vectors:[[8,9,10],[8,9,10]],model:'local:test-local'});
    fail=false;
    expect(await service.embed(['same','new'])).toEqual({vectors:[[1,2],[1,2]],model:'nvidia/nemotron-3-embed-1b'});
  });
  it('rejects malformed vectors and does not cache them',async()=>{
    let valid=false;
    const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({data:[{index:0,embedding:valid?[1,2]:[0,0]}]})));
    const service=createModelServices({apiKey:'test',chat:async()=>({}),fetchImpl:fetchImpl as typeof fetch});
    expect(await service.embed(['x'])).toBeNull();
    valid=true;
    expect(await service.embed(['x'])).toEqual({vectors:[[1,2]],model:'nvidia/nemotron-3-embed-1b'});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
