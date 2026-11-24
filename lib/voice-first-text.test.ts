import {describe,it,expect} from 'vitest';
import {waitForFirstVoiceText} from './voice-first-text.ts';
import {createModelRouter} from './model-router.ts';
const event=(delta:object)=>'data: '+JSON.stringify({choices:[{delta}]})+'\n\n';
const done='data: [DONE]\n\n';
const response=(text:string)=>new Response(text,{headers:{'content-type':'text/event-stream'}});
describe('voice first visible text',()=>{
  it('does not confuse reasoning or role events with audible answer content',async()=>{
    const before=event({role:'assistant'})+event({reasoning_content:'planning'})+event({content:'  '});
    const result=await waitForFirstVoiceText(response(before+event({content:'Merhaba'})+done),new AbortController().signal);
    expect(await result.text()).toBe(before+event({content:'Merhaba'})+done);
  });
  it('rejects empty answer before handing the stream to the client',async()=>{
    await expect(waitForFirstVoiceText(response(event({reasoning_content:'thinking'})+done),new AbortController().signal)).rejects.toThrow('VOICE_EMPTY_STREAM');
  });
  it('falls back to a configured quick model without replaying a partly visible answer',async()=>{
    const router=createModelRouter({chain:['huge','lightning','flash'],keepFirst:['lightning'],log:()=>{}});
    const calls:string[]=[];
    const result=await router.send(JSON.stringify({model:'lightning',stream:true,messages:[]}),async body=>{
      const model=JSON.parse(body).model;calls.push(model);
      return response(model==='lightning'?event({reasoning_content:'wait'})+done:event({content:'Selam'})+done);
    },undefined,undefined,true);
    expect(calls).toEqual(['lightning','flash']);
    expect(router.modelFor(result)).toBe('flash');
    expect(await result.text()).toContain('Selam');
  });
  it('stops a body that never produces content when its deadline is aborted',async()=>{
    let canceled=false;
    const res=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(event({reasoning_content:'wait'})));},cancel(){canceled=true;}}));
    const c=new AbortController();
    const result=waitForFirstVoiceText(res,c.signal);
    c.abort();
    await expect(result).rejects.toThrow();
    expect(canceled).toBe(true);
  });
});
