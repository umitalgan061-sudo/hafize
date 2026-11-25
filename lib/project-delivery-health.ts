import {OWNER_PROJECTS} from './owner-project-catalog.ts';
const SHA=/^[a-f0-9]{40}$/i;
const fail=(code:string,status=400):never=>{throw Object.assign(new Error(code),{code,status});};
const BORSA='https://borsa-api.hafize-worker.workers.dev';
const FRONT='https://hafize-ua.web.app';
const BACK='https://hafize-free.onrender.com';
type HttpEvidence={url:string;status:number|null;reachable:boolean;ok:boolean;headers?:Record<string,string>;body?:unknown;error?:string};
async function jsonBounded(res:Response){
 if(!res.body)return null;const reader=res.body.getReader();let total=0;const chunks:Uint8Array[]=[];
 try{while(true){const r=await reader.read();if(r.done)break;total+=r.value.length;if(total>65536){await reader.cancel();return null;}chunks.push(r.value);}
 return JSON.parse(Buffer.concat(chunks,total).toString('utf8')) as unknown;
 }catch{return null;}finally{reader.releaseLock();}
}
const record=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function createProjectDeliveryHealth(fetchImpl:typeof fetch=fetch){
 async function observe(url:string,signal?:AbortSignal,options:{method?:string;headers?:Record<string,string>;json?:boolean}={}):Promise<HttpEvidence>{
  signal?.throwIfAborted();
  try{
   const r=await fetchImpl(url,{method:options.method??'GET',headers:{Accept:options.json?'application/json':'text/html',...options.headers},redirect:'manual',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
   const evidence={url,status:r.status,reachable:true,ok:r.ok,headers:{allowOrigin:r.headers.get('access-control-allow-origin')??'',contentType:r.headers.get('content-type')??'',location:r.headers.get('location')??''}};
   if(options.json&&r.ok)return {...evidence,body:await jsonBounded(r)};
   await r.body?.cancel().catch(()=>{});
   return evidence;
  }catch(error){if(signal?.aborted)throw error;return {url,status:null,reachable:false,ok:false,error:error instanceof Error&&error.name==='TimeoutError'?'HTTP_TIMEOUT':'HTTP_UNREACHABLE'};}
 }
 return async(raw:unknown,signal?:AbortSignal)=>{
  const args=record(raw);
  if(Object.keys(args).some(k=>!['project','sha'].includes(k))||typeof args.project!=='string')fail('PROJECT_HEALTH_INVALID_ARGUMENTS');
  const project=OWNER_PROJECTS.find(p=>p.id===args.project);
  if(!project)return fail('PROJECT_HEALTH_UNKNOWN_PROJECT',404);
  const sha=args.sha===undefined?null:typeof args.sha==='string'&&SHA.test(args.sha)?args.sha.toLowerCase():fail('PROJECT_HEALTH_INVALID_SHA');
  if(sha&&project.id!=='hafize'&&project.id!=='borsa')fail('PROJECT_HEALTH_RELEASE_MARKER_UNSUPPORTED');
  const endpoints=project.urls.map(u=>String(u));
  if(project.id==='hafize') {
   const marker=BACK+'/release.json'+(sha?'?commit='+sha:'');
   const [page,release,live,ready,alias]=await Promise.all([observe(BACK,signal),observe(marker,signal,{json:true}),observe(BACK+'/api/health/live',signal,{json:true}),observe(BACK+'/api/health/ready',signal,{json:true}),observe(FRONT,signal)]);
   const body=record(release.body),actual=typeof body.commit==='string'&&SHA.test(body.commit)?body.commit.toLowerCase():null;
   const liveBody=record(live.body),backendSha=typeof liveBody.revision==='string'&&SHA.test(liveBody.revision)?liveBody.revision.toLowerCase():null;
   return {project:project.id,repository:project.repository,canonicalUrl:BACK,legacyAlias:{url:FRONT,status:alias.status,redirectVerified:[301,302,307,308].includes(alias.status??0)&&alias.headers?.location===BACK+'/'},frontend:{status:page.status,reachable:page.reachable,html:page.ok&&Boolean(page.headers?.contentType.includes('text/html')),release:{status:release.status,actualSha:actual,expectedSha:sha,match:sha?actual===sha:null}},backend:{liveStatus:live.status,readyStatus:ready.status,live:live.ok,ready:ready.ok,revision:{actualSha:backendSha,expectedSha:sha,match:sha?backendSha===sha:null}},authenticatedFunctionalTest:false,note:'Render is the canonical UI and API origin; Firebase is only a navigation alias. Release and health markers are verified on Render. This is not a signed-in functional test.'};
  }
  const pages=await Promise.all(endpoints.map(async url=>{const r=await observe(url,signal);return {url,status:r.status,reachable:r.reachable,html:r.ok&&Boolean(r.headers?.contentType.includes('text/html')),error:r.error??null};}));
  if(project.id==='borsa'){
   const releases=await Promise.all(endpoints.map(async url=>{const result=await observe(url+'/release.json'+(sha?'?commit='+sha:''),signal,{json:true});const body=record(result.body);const actual=body.project==='borsa'&&typeof body.commit==='string'&&SHA.test(body.commit)?body.commit.toLowerCase():null;return {url,status:result.status,actualSha:actual,expectedSha:sha,match:sha?actual===sha:null};}));
   const origins=['https://borsa-gunlugu.web.app','https://borsa-gunlugu.firebaseapp.com','https://borsa-gunlugu-ua.web.app','https://borsa-gunlugu-ua.firebaseapp.com'];
   const [health,auth,...preflight]=await Promise.all([observe(BORSA+'/health',signal,{json:true}),observe(BORSA+'/quotes?symbols=THYAO',signal,{headers:{Origin:origins[2]!}}),...origins.map(origin=>observe(BORSA+'/quotes',signal,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'Authorization'}}))]);
   const checks=preflight.map((r,i)=>({origin:origins[i],status:r.status,passed:r.status===204&&r.headers?.allowOrigin===origins[i]}));
   const h=record(health.body);
   return {project:project.id,repository:project.repository,pages,releases,worker:{healthStatus:health.status,marketHealth:health.ok&&h.ok===true,fundCount:Number.isSafeInteger(h.funds)?h.funds:null,cors:checks,corsAllPassed:checks.every(r=>r.passed),anonymousRejected:auth.status===401},authenticatedFunctionalTest:false,note:'Public health may use cached data; anonymous rejection and CORS are not proof of signed-in quote retrieval.'};
  }
  return {project:project.id,repository:project.repository,pages,hostingKnown:pages.length>0,authenticatedFunctionalTest:false,note:pages.length?'HTTP HTML response is not proof of complete functionality or exact deployed commit.':'No verified hosting destination in project catalog; inspect repository configuration rather than guessing.'};
 };
}
