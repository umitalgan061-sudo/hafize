import {describe,it,expect,vi} from 'vitest';
import {createProjectDeliveryHealth} from './project-delivery-health.ts';
const SHA='a'.repeat(40);
describe('project delivery verification',()=>{
 it('checks exact frontend release separately from backend readiness',async()=>{
  const f=vi.fn(async(u:URL|string)=>String(u).includes('release.json')?Response.json({commit:SHA}):String(u).includes('/ready')?new Response('',{status:503}):String(u).includes('/live')?Response.json({revision:'c'.repeat(40)}):new Response('<html/>',{headers:{'content-type':'text/html'}})) as unknown as typeof fetch;
  const run=createProjectDeliveryHealth(f);
  await expect(run({project:'hafize',sha:SHA})).resolves.toMatchObject({frontend:{release:{actualSha:SHA,match:true}},backend:{live:true,ready:false,revision:{actualSha:'c'.repeat(40),match:false}},authenticatedFunctionalTest:false});
  await expect(run({project:'hafize',sha:'b'.repeat(40)})).resolves.toMatchObject({frontend:{release:{match:false}}});
 });
 it('checks all 4 Borsa origins, health and anonymous denial independently',async()=>{
  const f=vi.fn(async(u:URL|string,opts?:RequestInit)=>{
   if(opts?.method==='OPTIONS'){const origin=new Headers(opts.headers).get('origin')!;return new Response(null,{status:204,headers:{'access-control-allow-origin':origin.includes('-ua.firebaseapp.com')?'https://wrong.example':origin}});}
   if(String(u).endsWith('/health'))return Response.json({ok:false,funds:0});
   if(String(u).includes('/quotes?'))return new Response('',{status:401});
   return new Response('<html/>',{headers:{'content-type':'text/html'}});
  }) as unknown as typeof fetch;
  await expect(createProjectDeliveryHealth(f)({project:'borsa'})).resolves.toMatchObject({worker:{marketHealth:false,corsAllPassed:false,anonymousRejected:true,cors:expect.arrayContaining([expect.objectContaining({origin:'https://borsa-gunlugu-ua.firebaseapp.com',passed:false})])},authenticatedFunctionalTest:false});
 });
 it('rejects arbitrary destinations and never guesses missing hosting',async()=>{
  const f=vi.fn() as unknown as typeof fetch;const run=createProjectDeliveryHealth(f);
  await expect(run({project:'https://internal.invalid'})).rejects.toMatchObject({code:'PROJECT_HEALTH_UNKNOWN_PROJECT'});
  await expect(run({project:'hafize',url:'https://internal.invalid'})).rejects.toMatchObject({code:'PROJECT_HEALTH_INVALID_ARGUMENTS'});
  await expect(run({project:'westeros'})).resolves.toMatchObject({hostingKnown:false,pages:[]});
  expect(f).not.toHaveBeenCalled();
 });
});
