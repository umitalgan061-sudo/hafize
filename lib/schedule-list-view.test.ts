import {describe,it,expect} from 'vitest';
import {scheduleListView} from './schedule-list-view.ts';
import {createScheduleHttpApi} from './schedule-http-api.ts';
import {createScheduleCommandBoundary} from './schedule-command-boundary.ts';
const rows=[{scheduleId:'a',runAt:'2026-01-01',status:'scheduled'},{scheduleId:'b',runAt:'2026-01-01',status:'running'},{scheduleId:'c',runAt:'2026-01-02',status:'failed'}];
describe('recovered schedule scope counts and keyset pagination',()=>{
 it('counts all owner rows while returning only the selected page',()=>{
 const result=scheduleListView(rows,new URLSearchParams('scope=active&limit=1'));
 expect(result.listMeta.scopeCounts).toMatchObject({all:3,active:2,history:1,failed:1});
 expect(result.schedules.map(x=>x.scheduleId)).toEqual(['a']);
 const next=scheduleListView(rows,new URLSearchParams({scope:'active',limit:'1',cursor:result.listMeta.nextCursor!}));
 expect(next.schedules.map(x=>x.scheduleId)).toEqual(['b']);expect(next.listMeta.nextCursor).toBeNull();
 });
 it('rejects bad query and cross-scope cursor, supports counts-only',()=>{
 const first=scheduleListView(rows,new URLSearchParams('limit=1'));
 expect(()=>scheduleListView(rows,new URLSearchParams({scope:'failed',cursor:first.listMeta.nextCursor!}))).toThrow();
 expect(()=>scheduleListView(rows,new URLSearchParams('limit=201'))).toThrow();
 expect(()=>scheduleListView(rows,new URLSearchParams('scope=all&scope=failed'))).toThrow();
 expect(scheduleListView(rows,new URLSearchParams('view=counts')).schedules).toEqual([]);
 });
 it('filters owner before computing counts and denies unauthorized requests',async()=>{
 const entries=rows.map((x,i)=>({...x,ownerId:i===2?'other':'mine',traceId:'t',agentId:'a',task:'task',attempts:0,maxAttempts:1,lastError:null,createdAt:'',updatedAt:''}));
 const commands=createScheduleCommandBoundary({store:{snapshot:async()=>({entries}),add:async()=>entries[0]!,read:async()=>null,cancel:async()=>entries[0]!},registry:{agents:[]},createTraceId:()=>''});
 const api=createScheduleHttpApi({authenticator:{authenticate:({headers}:any)=>headers==='ok'?{ok:true,principal:{authenticated:true,subject:'mine'}}:{ok:false}},commands,readJson:async()=>({})});
 const input={method:'GET',pathname:'/api/schedules',query:new URLSearchParams('view=counts')};
 expect(await api.handle({...input,headers:'ok'})).toMatchObject({status:200,body:{listMeta:{scopeCounts:{all:2,failed:0}}}});
 expect(await api.handle({...input,headers:'no'})).toMatchObject({status:401});
 });
});
