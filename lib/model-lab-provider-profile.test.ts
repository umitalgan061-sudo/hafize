import {describe,it,expect} from 'vitest';
import {KIMI_K31_PRO,modelLabChatPayload,productionLabCandidates,modelLabRequestTimeout} from './model-lab-provider-profile.ts';
describe('Kimi laboratory API profile',()=>{
 it('uses the documented request fields and retains tool/message definitions',()=>{
 const tools=[{type:'function',function:{name:'benchmark_echo'}}];
 const messages=[{role:'user',content:'synthetic'}];
 const body={model:KIMI_K31_PRO,messages,tools,max_tokens:256,temperature:0,tool_choice:'auto',stream:false};
 expect(modelLabChatPayload(body)).toEqual({model:KIMI_K31_PRO,messages,tools,max_tokens:1024,stream:false,seed:0,reasoning_effort:'low'});
 expect(body.temperature).toBe(0);
 });
 it('does not modify other models or auto-promote Kimi to production',()=>{
 const body={model:'nvidia/example',temperature:0};
 expect(modelLabChatPayload(body)).toBe(body);
 expect(productionLabCandidates(['nvidia/example',KIMI_K31_PRO])).toEqual(['nvidia/example']);
 });
});

it('extends only the exact Kimi chat probe timeout',()=>{expect(modelLabRequestTimeout('/chat/completions',{model:KIMI_K31_PRO})).toBe(90000);expect(modelLabRequestTimeout('/chat/completions',{model:'nvidia/example'})).toBe(35000);expect(modelLabRequestTimeout('/models',null)).toBe(35000);});
