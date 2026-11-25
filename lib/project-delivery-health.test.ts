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
   if(String(u).includes('/release.json'))return Response.json({project:'borsa',commit:SHA});
   if(String(u).endsWith('/health'))return Response.json({ok:false,funds:0});
   if(String(u).includes('/quotes?'))return new Response('',{status:401});
   return new Response('<html/>',{headers:{'content-type':'text/html'}});
  }) as unknown as typeof fetch;
  await expect(createProjectDeliveryHealth(f)({project:'borsa',sha:SHA})).resolves.toMatchObject({releases:[{actualSha:SHA,match:true},{actualSha:SHA,match:true}],worker:{marketHealth:false,corsAllPassed:false,anonymousRejected:true,cors:expect.arrayContaining([expect.objectContaining({origin:'https://borsa-gunlugu-ua.firebaseapp.com',passed:false})])},authenticatedFunctionalTest:false});
 });
 it('rejects arbitrary destinations and never guesses missing hosting',async()=>{
  const f=vi.fn() as unknown as typeof fetch;const run=createProjectDeliveryHealth(f);
  await expect(run({project:'https://internal.invalid'})).rejects.toMatchObject({code:'PROJECT_HEALTH_UNKNOWN_PROJECT'});
  await expect(run({project:'hafize',url:'https://internal.invalid'})).rejects.toMatchObject({code:'PROJECT_HEALTH_INVALID_ARGUMENTS'});
  await expect(run({project:'westeros'})).resolves.toMatchObject({hostingKnown:false,pages:[]});
  expect(f).not.toHaveBeenCalled();
 });
});

it('verifies the canonical Render UI and separately checks the Firebase alias',async()=>{
 const seen:string[]=[];
 const fetchImpl=vi.fn(async(u:URL|string)=>{
  const url=new URL(String(u));seen.push(url.href);
  if(url.hostname==='hafize-ua.web.app')return new Response(null,{status:302,headers:{location:'https://hafize-free.onrender.com/'}});
  if(url.pathname==='/release.json')return Response.json({commit:SHA});
  if(url.pathname==='/api/health/live')return Response.json({revision:SHA});
  if(url.pathname==='/api/health/ready')return Response.json({state:'ready'});
  return new Response('<html/>',{headers:{'content-type':'text/html'}});
 }) as unknown as typeof fetch;
 await expect(createProjectDeliveryHealth(fetchImpl)({project:'hafize',sha:SHA})).resolves.toMatchObject({canonicalUrl:'https://hafize-free.onrender.com',legacyAlias:{redirectVerified:true},frontend:{release:{match:true}},backend:{revision:{match:true}}});
 expect(seen.some(u=>u.startsWith('https://hafize-ua.web.app/release.json'))).toBe(false);
});
