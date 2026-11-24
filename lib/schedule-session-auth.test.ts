import {it,expect} from 'vitest';
import {createScheduleSessionAuthenticator} from './schedule-session-auth.ts';
import {createBearerPrincipalAuthenticator} from './server-auth.ts';
it('accepts only server-attached owner identity and preserves explicitly configured bearer scope',()=>{
 const legacy=createBearerPrincipalAuthenticator({token:'a'.repeat(32),subject:'legacy-owner'});
 const auth=createScheduleSessionAuthenticator(legacy);
 const req={};Object.defineProperty(req,'__hafizePrincipal',{value:Object.freeze({ownerId:'owner',sessionId:'b'.repeat(64)}),enumerable:false,configurable:false});
 expect(auth.authenticate({request:req})).toMatchObject({ok:true,principal:{subject:'owner'}});
 expect(auth.authenticate({headers:{'x-hafize-owner':'owner'}})).toMatchObject({ok:false});
 expect(auth.authenticate({request:{__hafizePrincipal:{ownerId:'owner',sessionId:'b'.repeat(64)}}})).toMatchObject({ok:false});
 expect(auth.authenticate({headers:{authorization:'Bearer '+'a'.repeat(32)}})).toMatchObject({ok:true,principal:{subject:'legacy-owner'}});
 expect(createScheduleSessionAuthenticator(null).authenticate()).toMatchObject({ok:false});
});

import {spawnSync} from 'node:child_process';
it('protects schedule HTTP requests with the real production guard and CSRF',()=>{
 const code=`
 import {createServer} from 'node:http';
 import assert from 'node:assert/strict';
 import {createScheduleHttpApi} from './lib/schedule-http-api.ts';
 import {createScheduleSessionAuthenticator} from './lib/schedule-session-auth.ts';
 import {createBearerPrincipalAuthenticator} from './lib/server-auth.ts';
 const legacy=createBearerPrincipalAuthenticator({token:'b'.repeat(64),subject:'legacy-owner'});
 const commands={list:async({principal})=>({ok:true,subject:principal.subject}),create:async({principal})=>({ok:true,subject:principal.subject}),cancel:async()=>({ok:true})};
 const api=createScheduleHttpApi({authenticator:createScheduleSessionAuthenticator(legacy),commands,readJson:async()=>({})});
 const server=createServer(async(req,res)=>{const out=await api.handle({request:req,method:req.method,pathname:new URL(req.url,'http://localhost').pathname,headers:req.headers});res.writeHead(out.status);res.end(JSON.stringify(out.body));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(url+'/api/schedules')).status,401);
  const login=await fetch(url+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:'a'.repeat(64)})});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];const {csrf}=await login.json();
  assert.equal((await (await fetch(url+'/api/schedules',{headers:{cookie}})).json()).subject,'owner');
  assert.equal((await fetch(url+'/api/schedules',{method:'POST',headers:{cookie}})).status,403);
  assert.equal((await fetch(url+'/api/schedules',{method:'POST',headers:{cookie,'x-hafize-csrf':csrf}})).status,201);
  assert.equal((await (await fetch(url+'/api/schedules',{headers:{authorization:'Bearer '+'b'.repeat(64)}})).json()).subject,'legacy-owner');
 }finally{await new Promise(resolve=>server.close(resolve));}
 `;
 const result=spawnSync(process.execPath,['--import','./lib/production-guard.ts','--input-type=module','-e',code],{encoding:'utf8',timeout:15000,env:{...process.env,HOST:'127.0.0.1',NODE_ENV:'test',HAFIZE_AUTH_REQUIRED:'true',HAFIZE_AUTH_TOKEN:'a'.repeat(64),HAFIZE_AUTH_SUBJECT:'owner',HAFIZE_COOKIE_SECURE:'false',HAFIZE_SCHEDULE_AUTH_TOKEN:'b'.repeat(64),HAFIZE_SCHEDULE_AUTH_SUBJECT:'legacy-owner',HAFIZE_CONNECTOR_AUTH_TOKEN:'',HAFIZE_CONNECTOR_AUTH_SUBJECT:''}});
 expect(result.status,result.stderr).toBe(0);
},20000);
