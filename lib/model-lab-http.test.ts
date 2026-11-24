
import {describe,it,expect,vi} from 'vitest';
import {modelLabAction} from './model-lab-http.ts';
import {createModelLab} from './model-lab.ts';
describe('model lab HTTP actions',()=>{
  it('never passes arbitrary paths, models, questions, or provider overrides to upstream',async()=>{
    const request=vi.fn(async()=>new Response(JSON.stringify({data:[]})));
    const lab=createModelLab({allowed:['nvidia/example'],request});
    for(const body of [{action:'council',question:'x'},{action:'discover',url:'https://example.com'},{action:'probe',model:'https://example.com'},{action:'probe',model:'vendor/unknown'},{action:'batch',model:'nvidia/example'},null])await expect(modelLabAction(lab,body)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    expect((await modelLabAction(lab,{action:'discover'})).catalog?.ids).toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

it('returns actual comprehensive round evidence and refuses provider overrides',async()=>{
 const request=vi.fn(async(_path,body)=>new Response(JSON.stringify({choices:[{message:body?.tools?{tool_calls:[{function:{name:'benchmark_echo',arguments:'{"value":42}'}}]}:{content:'{"capital":"Ankara","math":383,"code":12}'}}]})));
 const lab=createModelLab({allowed:['nvidia/example'],request});
 await expect(modelLabAction(lab,{action:'comprehensive',apiKey:'not-accepted'})).rejects.toThrow();
 expect(request).not.toHaveBeenCalled();
 const result=await modelLabAction(lab,{action:'comprehensive'});
 expect(result).toMatchObject({comprehensive:{smoke:[{model:'nvidia/example',status:'passed'}],pending:[]}});
 expect(request.mock.calls.length).toBeLessThanOrEqual(5);
});
