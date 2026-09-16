import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

let seen = null;
const api=createScheduleHttpApi({
 authenticator:{authenticate:()=>({ok:true,principal:{authenticated:true,subject:'u'}})},
 commands:{create:async()=>({ok:true}),list:async()=>({ok:true,schedules:[]}),update:async(v)=>{seen=v;return {ok:true,schedule:{scheduleId:v.scheduleId}}},cancel:async()=>({ok:true})},
 readJson:async()=>({runAt:'2026-09-17T10:00:00Z'})
});
const response=await api.handle({method:'PATCH',pathname:'/api/schedules/schedule%5F1',headers:{},request:{}});
assert.equal(response.status,200);
assert.equal(seen.scheduleId,'schedule_1');
const slash=await api.handle({method:'PATCH',pathname:'/api/schedules/schedule_1/extra',headers:{},request:{}});
assert.equal(slash.matched,false);
console.log('scheduled task path safety ok');
