import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.ts';
const calls=[];
const api=createScheduleHttpApi({
  authenticator:{authenticate:()=>({ok:true,principal:{authenticated:true,subject:'u'}})},
  commands:{
    async list(){return {ok:true,schedules:[]};},
    async create(){return {ok:true,schedule:{scheduleId:'s'}};},
    async cancel({scheduleId}){calls.push(['cancel',scheduleId]);return {ok:true,schedule:{scheduleId}};},
    async pause({scheduleId}){calls.push(['pause',scheduleId]);return {ok:true,schedule:{scheduleId,status:'paused'}};},
    async resume({scheduleId}){calls.push(['resume',scheduleId]);return {ok:true,schedule:{scheduleId,status:'scheduled'}};}
  },
  readJson:async()=>({action:'pause'})
});
const pause=await api.handle({method:'PATCH',pathname:'/api/schedules/s1',headers:{}});
assert.equal(pause.status,200);
assert.deepEqual(calls,[['pause','s1']]);
const resumeApi=createScheduleHttpApi({
  authenticator:{authenticate:()=>({ok:true,principal:{authenticated:true,subject:'u'}})},
  commands:{list:async()=>({ok:true,schedules:[]}),create:async()=>({ok:true}),cancel:async()=>({ok:true}),pause:async()=>({ok:true}),resume:async({scheduleId})=>({ok:true,schedule:{scheduleId,status:'scheduled'}})},
  readJson:async()=>({action:'resume'})
});
assert.equal((await resumeApi.handle({method:'PATCH',pathname:'/api/schedules/s2',headers:{}})).status,200);
console.log('scheduled recurrence HTTP patch: ok');
