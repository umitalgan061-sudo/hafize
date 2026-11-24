import {pathToFileURL} from 'node:url';
const BACKEND='https://hafize-free.onrender.com';
const FRONTEND='https://hafize-ua.web.app';
const SHA=/^[a-f0-9]{40}$/i;
async function readJson(fetchImpl,url,allowUnavailable=false){
 const response=await fetchImpl(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000),headers:{Accept:'application/json'}});
 if(!response.ok&&!(allowUnavailable&&response.status===503))throw Error('HTTP_'+response.status);
 const reader=response.body?.getReader();if(!reader)throw Error('EMPTY_BODY');
 let length=0;const decoder=new TextDecoder();let body='';
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>131072){await reader.cancel();throw Error('BODY_TOO_LARGE');}body+=decoder.decode(value,{stream:true});}body+=decoder.decode();}finally{reader.releaseLock();}
 const result=JSON.parse(body);if(!result||typeof result!=='object'||Array.isArray(result))throw Error('INVALID_JSON');return {body:result,httpStatus:response.status};
}
export async function verifyBackend({fetchImpl=fetch,expectedRevision=''}={}){
 if(expectedRevision&&!SHA.test(expectedRevision))throw Error('INVALID_EXPECTED_REVISION');
 const {body:live}=await readJson(fetchImpl,BACKEND+'/api/health/live');
 if(live.status!=='ok'||!SHA.test(String(live.revision??'')))throw Error('BACKEND_REVISION_UNAVAILABLE');
 if(expectedRevision&&live.revision!==expectedRevision)throw Error('BACKEND_REVISION_MISMATCH');
 const {body:health}=await readJson(fetchImpl,BACKEND+'/api/health');
 const {body:ready,httpStatus:readinessHttp}=await readJson(fetchImpl,BACKEND+'/api/health/ready',true);
 const {body:release}=await readJson(fetchImpl,FRONTEND+'/release.json');
 if(health.status!=='ok'||!['ready','degraded','blocked','unknown'].includes(ready.state)||!SHA.test(String(release.commit??'')))throw Error('BACKEND_READINESS_INVALID');
 const components=Object.fromEntries(['auth','pwa','skills','memory','schedule','connectors','model','release'].map(key=>{const state=health.readiness?.components?.[key];return [key,['ready','warning','blocked','unknown'].includes(state)?state:'unknown'];}));
 return {backendRevision:live.revision,frontendRevision:release.commit,revisionsMatch:live.revision===release.commit,readiness:ready.state,readinessHttp,components,nvidiaConfigured:health.nvidiaConfigured===true,githubWriteConfigured:health.githubWriteConfigured===true,scheduleApiConfigured:health.scheduleApiConfigured===true,scheduleWorkerConfigured:health.scheduleWorkerConfigured===true,providerInferenceTested:false,ownerSessionTested:false};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{const report=await verifyBackend({expectedRevision:process.env.HAFIZE_EXPECTED_REVISION||''});console.log(JSON.stringify(report,null,2));if(process.env.GITHUB_STEP_SUMMARY){const {appendFileSync}=await import('node:fs');appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Public backend smoke test\n\n'+Object.entries(report).map(([key,value])=>'- '+key+': '+(typeof value==='object'?JSON.stringify(value):String(value))).join('\n')+'\n');}if(report.readinessHttp!==200||!['ready','degraded'].includes(report.readiness))process.exitCode=1;}
 catch(error){const code=error instanceof Error&&/^(?:HTTP_\d{3}|BACKEND_[A-Z_]+|INVALID_[A-Z_]+|EMPTY_BODY|BODY_TOO_LARGE)$/.test(error.message)?error.message:'BACKEND_REQUEST_FAILED';console.error(code);process.exitCode=1;}
}
