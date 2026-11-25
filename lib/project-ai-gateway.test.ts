import {describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createProjectAiGateway} from './project-ai-gateway.ts';
import {markCompletionOrigin} from './model-response-origin.ts';
const token='a'.repeat(43),other='b'.repeat(43),digest=(x:string)=>createHash('sha256').update(x).digest('hex');
describe('scoped central project AI',()=>{
 it('isolates projects and never lets callers choose model or tools',async()=>{
  const complete=vi.fn(async()=>{const r={choices:[{message:{content:'Merhaba'}}]};markCompletionOrigin(r,'nvidia/actual-model');return r;});
  const g=createProjectAiGateway({hashes:JSON.stringify({borsa:digest(token),retake:digest(other)}),model:'nvidia/configured',complete});
  expect(g.status()).toEqual({configuredProjects:2,enabled:true});
  expect(()=>g.authorize('retake','Bearer '+token,undefined)).toThrow('PROJECT_AI_AUTH_REQUIRED');
  expect(()=>g.authorize('borsa','Bearer '+token,'https://example.com')).toThrow('PROJECT_AI_SERVER_ONLY');
  expect(()=>g.authorize('hafize','Bearer '+token,undefined)).toThrow('PROJECT_AI_NOT_CONFIGURED');
  const grant=g.authorize('borsa','Bearer '+token,undefined);
  try{
   await expect(g.text('borsa',{text:'hello',model:'other'})).rejects.toMatchObject({code:'PROJECT_AI_INVALID_INPUT'});
   await expect(g.text('borsa',{text:'hello',tools:[]})).rejects.toMatchObject({code:'PROJECT_AI_INVALID_INPUT'});
   expect(complete).not.toHaveBeenCalled();
   await expect(g.text('borsa',{text:'Hello',task:'rewrite'})).resolves.toMatchObject({project:'borsa',text:'Merhaba',model:'nvidia/actual-model',toolsExecuted:false});
   expect(complete.mock.calls).toHaveLength(1);
  }finally{grant.release();}
 });
 it('fails closed on duplicate or malformed configuration',()=>{
  for(const hashes of [JSON.stringify({borsa:digest(token),retake:digest(token)}),JSON.stringify({unknown:digest(token)}),JSON.stringify({borsa:token})]){
   const g=createProjectAiGateway({hashes,model:'x',complete:vi.fn()});
   expect(g.status().enabled).toBe(false);expect(()=>g.authorize('borsa','Bearer '+token,undefined)).toThrow('PROJECT_AI_NOT_CONFIGURED');
  }
 });
 it('surfaces provider throttling without leaking provider response',async()=>{
  const g=createProjectAiGateway({hashes:JSON.stringify({borsa:digest(token)}),model:'x',complete:async()=>{throw Object.assign(Error('private error'),{status:429});}});
  const grant=g.authorize('borsa','Bearer '+token,undefined);
  try{await expect(g.text('borsa',{text:'test'})).rejects.toMatchObject({code:'PROJECT_AI_UPSTREAM_LIMIT',status:429});}finally{grant.release();}
 });
});
