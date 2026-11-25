import {describe,it,expect,vi} from 'vitest';
import {createNvidiaAgentWorkspace} from './nvidia-agent-workspace.ts';
import {createModelLab} from './model-lab.ts';
describe('NVIDIA agent workspace',()=>{
 it('reports catalog and all blueprints without claiming deployment or sending anything',async()=>{
  const w=createNvidiaAgentWorkspace({lab:null,ownerRequest:'incele',nimStatus:()=>({asr:false})});
  const status=await w.execute({action:'status'});
  expect(status).toMatchObject({connected:false,catalogIsNotExecutionProof:true,nim:{asr:false}});
  const b=await w.execute({action:'blueprints'});
  expect(b).toMatchObject({blueprints:expect.arrayContaining([expect.objectContaining({id:'voice',officialDeployment:false})])});
  await expect(w.execute({action:'discover'})).rejects.toMatchObject({code:'NVIDIA_WORKSPACE_NOT_CONFIGURED'});
 });
 it('requires the real owner request for tests and explicit source text, and refuses arbitrary fields',async()=>{
  const fetch=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'Teşekkür ederim.'}}]})));
  const lab=createModelLab({allowed:['nvidia/example'],request:fetch});
  const w=createNvidiaAgentWorkspace({lab,ownerRequest:'NVIDIA ile şu metni çevir: Thank you.',nimStatus:()=>({})});
  await expect(w.execute({action:'translate',text:'unrelated private text',pair:'en-tr'})).rejects.toMatchObject({code:'NVIDIA_WORKSPACE_SOURCE_NOT_AUTHORIZED'});
  await expect(w.execute({action:'translate',text:'Thank you.',pair:'en-tr',url:'https://example.com'})).rejects.toMatchObject({code:'NVIDIA_WORKSPACE_INVALID_INPUT'});
  await expect(w.execute({action:'translation_probe'})).rejects.toMatchObject({code:'NVIDIA_WORKSPACE_TEST_NOT_AUTHORIZED'});
  expect(fetch).not.toHaveBeenCalled();
  await expect(w.execute({action:'translate',text:'Thank you.',pair:'en-tr'})).resolves.toMatchObject({model:'nvidia/riva-translate-4b-instruct-v2',text:'Teşekkür ederim.'});
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('uses the existing synthetic probe and preserves provider rate limiting',async()=>{
  const fetch=vi.fn(async()=>new Response('',{status:429}));
  const lab=createModelLab({allowed:['nvidia/example'],request:fetch});
  const w=createNvidiaAgentWorkspace({lab,ownerRequest:'NVIDIA modellerini test et',nimStatus:()=>({})});
  await expect(w.execute({action:'probe',model:'nvidia/example'})).resolves.toMatchObject({model:'nvidia/example',status:'rate_limited'});
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it.each([
  ['Hafize, NVIDIA modellerini test et, incele, doğrula ve geliştir.',true,'authorized'],
  ['NVIDIA audit_window işlemini yeniden çalıştır.',true,'authorized'],
  ['Kaldığın yerden devam et.',false,'provider_not_mentioned'],
  ['NVIDIA modellerini listele.',false,'test_not_requested'],
  ['NVIDIA modellerini test etme.',false,'explicit_negative_instruction']
 ] as const)('reports current request test authorization without leaking the request: %s',async(ownerRequest,authorized,reason)=>{
  const fetch=vi.fn(async()=>new Response('',{status:429}));
  const lab=createModelLab({allowed:['nvidia/example'],request:fetch});
  const w=createNvidiaAgentWorkspace({lab,ownerRequest,nimStatus:()=>({})});
  const status=await w.execute({action:'status'});
  expect(status).toMatchObject({testAuthorization:{authorized,reason,source:'current_owner_message',scope:'synthetic_diagnostics_only'}});
  expect(JSON.stringify(status)).not.toContain(ownerRequest);
  expect(fetch).not.toHaveBeenCalled();
  if(authorized){
   await expect(w.execute({action:'probe',model:'nvidia/example'})).resolves.toMatchObject({status:'rate_limited'});
   expect(fetch).toHaveBeenCalledTimes(1);
  }else{
   await expect(w.execute({action:'probe',model:'nvidia/example'})).rejects.toMatchObject({code:'NVIDIA_WORKSPACE_TEST_NOT_AUTHORIZED',status:403});
   expect(fetch).not.toHaveBeenCalled();
  }
 });
});
