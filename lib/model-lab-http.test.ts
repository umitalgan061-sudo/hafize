
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
