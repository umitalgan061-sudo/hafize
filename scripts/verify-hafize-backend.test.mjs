import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyBackend} from './verify-hafize-backend.mjs';
const sha='a'.repeat(40);
const replies={'/api/health/live':{status:'ok',revision:sha},'/api/health':{status:'ok',nvidiaConfigured:true,githubWriteConfigured:false,secret:'never report raw health'},'/api/health/ready':{status:'ready',state:'degraded'},'/release.json':{commit:sha}};
test('public health and matching releases do not prove API inference or owner session',async()=>{
 const report=await verifyBackend({expectedRevision:sha,fetchImpl:async url=>new Response(JSON.stringify(replies[new URL(url).pathname]))});
 assert.equal(report.revisionsMatch,true);assert.equal(report.nvidiaConfigured,true);assert.equal(report.providerInferenceTested,false);assert.equal(report.ownerSessionTested,false);assert.equal(JSON.stringify(report).includes('secret'),false);
});
test('fails closed on missing revision or unexpected commit',async()=>{
 await assert.rejects(verifyBackend({expectedRevision:'b'.repeat(40),fetchImpl:async()=>new Response(JSON.stringify(replies['/api/health/live']))}),/BACKEND_REVISION_MISMATCH/);
 await assert.rejects(verifyBackend({fetchImpl:async()=>new Response(JSON.stringify({status:'ok'}))}),/BACKEND_REVISION_UNAVAILABLE/);
});

test('reports blocked readiness as a diagnostic without hiding the HTTP 503 or exposing raw details',async()=>{
 const report=await verifyBackend({fetchImpl:async url=>{const path=new URL(url).pathname;if(path==='/api/health/ready')return new Response(JSON.stringify({status:'not_ready',state:'blocked'}),{status:503});if(path==='/api/health')return new Response(JSON.stringify({...replies[path],readiness:{components:{schedule:'blocked',model:'ready',auth:'ready',memory:'warning'},secret:'private'}}));return new Response(JSON.stringify(replies[path]));}});
 assert.equal(report.readinessHttp,503);assert.equal(report.readiness,'blocked');assert.equal(report.components.schedule,'blocked');assert.equal(report.nvidiaConfigured,true);assert.equal(JSON.stringify(report).includes('private'),false);
});
