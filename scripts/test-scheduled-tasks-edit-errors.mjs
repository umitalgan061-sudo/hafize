import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const outputs = ['AUTH_REQUIRED','INVALID_SCHEDULE_COMMAND','SCHEDULE_NOT_FOUND','SCHEDULE_NOT_EDITABLE','SCHEDULE_CAPACITY_REACHED'];
const api = createScheduleHttpApi({
  authenticator:{ authenticate:()=>({ok:true,principal:{authenticated:true,subject:'u'}}) },
  commands:{ create:async()=>({ok:true}), list:async()=>({ok:true,schedules:[]}), update:async()=>({ok:false,error:outputs[0]}), cancel:async()=>({ok:true}) },
  readJson:async()=>({task:'x'})
});
for (const [error,status] of [['AUTH_REQUIRED',401],['INVALID_SCHEDULE_COMMAND',400],['SCHEDULE_NOT_FOUND',404],['SCHEDULE_NOT_EDITABLE',409],['SCHEDULE_CAPACITY_REACHED',503]]) {
  api.handle = api.handle;
  const result = await createScheduleHttpApi({
    authenticator:{authenticate:()=>({ok:true,principal:{authenticated:true,subject:'u'}})},
    commands:{create:async()=>({ok:true}),list:async()=>({ok:true,schedules:[]}),update:async()=>({ok:false,error}),cancel:async()=>({ok:true})},
    readJson:async()=>({task:'x'})
  }).handle({method:'PATCH',pathname:'/api/schedules/schedule_1',headers:{},request:{}});
  assert.equal(result.status,status);
  assert.equal(result.body.code,error);
}
console.log('scheduled task edit error mapping ok');
