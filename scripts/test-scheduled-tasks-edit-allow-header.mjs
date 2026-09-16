import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const api=createScheduleHttpApi({authenticator:{authenticate:()=>({ok:true,principal:{authenticated:true,subject:'u'}})},commands:{create:async()=>({ok:true}),update:async()=>({ok:true}),list:async()=>({ok:true,schedules:[]}),cancel:async()=>({ok:true})},readJson:async()=>({})});
const response=await api.handle({method:'OPTIONS',pathname:'/api/schedules/schedule_1',headers:{},request:{}});
assert.equal(response.status,405);
assert.equal(response.headers.Allow,'PATCH, DELETE');
console.log('scheduled task patch Allow header ok');
