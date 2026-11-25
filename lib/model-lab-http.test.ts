
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

it('translates only explicitly submitted text through the fixed Riva model without retaining it',async()=>{let snapshot:unknown;const request=vi.fn(async(_path,body)=>{expect(body.model).toBe('nvidia/riva-translate-4b-instruct-v2');expect(body.messages[0].content).toBe('en-tr');return new Response(JSON.stringify({choices:[{message:{content:'Merhaba'}}]}));});const lab=createModelLab({allowed:[],request,storage:{load:()=>null,save:value=>{snapshot=value;}}});await expect(modelLabAction(lab,{action:'translate_text',text:'Hello test',pair:'en-tr'})).rejects.toThrow();await expect(modelLabAction(lab,{action:'translate_text',text:'Hello test',pair:'en-tr',consent:true,url:'https://example.com'})).rejects.toThrow();expect(request).not.toHaveBeenCalled();expect(await modelLabAction(lab,{action:'translate_text',text:'Hello test',pair:'en-tr',consent:true})).toMatchObject({translationOutput:{text:'Merhaba',pair:'en-tr'}});expect(JSON.stringify(snapshot)).not.toContain('Hello test');expect(JSON.stringify(snapshot)).not.toContain('Merhaba');expect(request).toHaveBeenCalledTimes(1);});

it('performs consented semantic retrieval with separate passage and query calls and no stored text',async()=>{const model='nvidia/nemotron-3.5-embed-1b';let snapshot:unknown;const request=vi.fn(async(_path,body)=>{expect(body.model).toBe(model);expect(body.modality).toBe('text');return new Response(JSON.stringify({data:(body.input_type==='passage'?[[0,1],[1,0]]:[[1,0]]).map((embedding,index)=>({index,embedding}))}));});const lab=createModelLab({allowed:[],specialistModels:[model],request,storage:{load:()=>null,save:value=>{snapshot=value;}}});const input={action:'semantic_search',text:'Elma.\n\nAnkara başkent.',query:'Türkiye merkezi',model,consent:true};await expect(modelLabAction(lab,{...input,consent:false})).rejects.toThrow();await expect(modelLabAction(lab,{...input,model:'vendor/unknown'})).rejects.toThrow();expect(request).not.toHaveBeenCalled();expect(await modelLabAction(lab,input)).toMatchObject({semanticOutput:{model,results:[{source:2,text:'Ankara başkent.'},{source:1}]}});expect(request).toHaveBeenCalledTimes(2);expect(request.mock.calls.map(c=>c[1].input_type)).toEqual(['passage','query']);expect(JSON.stringify(snapshot)).not.toContain('Ankara başkent');});

it('uses the hosted rerank contract, shares lab request budget and validates every ranked source',async()=>{
 let snapshot:unknown;let invalid=false;
 const request=vi.fn(async(path,body)=>{expect(path).toBe('/reranking');expect(body.model).toBe('nvidia/nemotron-3.5-rerank-8b');expect(body.query.text).toBeTruthy();return Response.json({rankings:invalid?[{index:0,logit:1},{index:0,logit:2}]:body.passages.map((_p:unknown,index:number)=>({index,logit:index===1?9:1}))});});
 const lab=createModelLab({allowed:[],rerankConfigured:true,request,storage:{load:()=>null,save:value=>{snapshot=value;}}});
 const input={action:'rerank_text',text:'Elma.\n\nAnkara başkent.',query:'Türkiye merkezi',consent:true};
 await expect(modelLabAction(lab,{...input,consent:false})).rejects.toThrow();
 expect(request).not.toHaveBeenCalled();
 await expect(modelLabAction(lab,{action:'rerank_probe'})).resolves.toMatchObject({reranking:{status:'passed',relevantFirst:true}});
 await expect(modelLabAction(lab,input)).resolves.toMatchObject({rerankOutput:{results:[{source:2,text:'Ankara başkent.',logit:9},{source:1}]}});
 expect(JSON.stringify(snapshot)).not.toContain('Ankara başkent');expect(lab.status().requestsRemaining).toBe(10);
 invalid=true;await expect(modelLabAction(lab,input)).rejects.toThrow('MODEL_LAB_INVALID_RERANK_RESPONSE');
});
