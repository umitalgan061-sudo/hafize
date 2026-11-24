
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

describe('specialist service validation',()=>{
  it('makes no rerank request unless enabled and validates all result indices',async()=>{
    let bad=false;const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({rankings:bad?[{index:1,logit:3},{index:1,logit:2}]:[{index:0,logit:1},{index:1,logit:3}]})));
    const base={apiKey:'test',chat:async()=>({}),fetchImpl:fetchImpl as typeof fetch};
    expect(await createModelServices(base).rerank('q',['a','b'])).toBeNull();expect(fetchImpl).not.toHaveBeenCalled();
    const models=createModelServices({...base,rerankEnabled:true});expect(await models.rerank('q',['a','b'])).toEqual([{index:1,logit:3},{index:0,logit:1}]);bad=true;expect(await models.rerank('q',['a','b'])).toBeNull();
  });
  it('does not falsely mark an unknown safety output as checked',async()=>{const models=createModelServices({apiKey:'test',chat:async()=>({choices:[{message:{content:'unexpected'}}]})});expect(await models.safetyCheck('test')).toMatchObject({checked:false});});
  it('rejects non-image bytes even if the upstream returned base64',async()=>{const models=createModelServices({apiKey:'test',chat:async()=>({}),fetchImpl:async()=>new Response(JSON.stringify({artifacts:[{base64:Buffer.from('not image').toString('base64')}]}))});await expect(models.generateImage({prompt:'test'})).rejects.toThrow('IMAGE_GENERATION_INVALID_FORMAT');});
});
