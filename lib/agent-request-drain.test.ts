import {describe,it,expect,vi} from 'vitest';
import {createAgentRequestDrain} from './agent-request-drain.ts';
describe('agent request drain',()=>{
 it('rejects new work after shutdown, and waits for terminal persistence',async()=>{
  const drain=createAgentRequestDrain();
  let saved=false;
  let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const task=drain.start(async()=>{await pending;saved=true;});
  expect(drain.activeCount()).toBe(1);
  const completed=drain.drain();
  expect(drain.closing()).toBe(true);
  expect(drain.start(async()=>{throw Error('not admitted');})).toBeNull();
  expect(saved).toBe(false);
  release();await task;
  expect(await completed).toBe(true);
  expect(saved).toBe(true);
  expect(drain.activeCount()).toBe(0);
 });
 it('settles rejected handlers and does not make shutdown fail',async()=>{
  const drain=createAgentRequestDrain();
  const task=drain.start(async()=>{throw Error('failed');})!;
  const result=drain.drain();
  await expect(task).rejects.toThrow('failed');
  expect(await result).toBe(true);
  expect(drain.activeCount()).toBe(0);
 });
 it('bounds the shutdown wait without losing track of unfinished work',async()=>{
  vi.useFakeTimers();
  try{
   const drain=createAgentRequestDrain();
   let release!:()=>void;
   const task=drain.start(()=>new Promise<void>(resolve=>{release=resolve;}));
   const result=drain.drain(50);
   await vi.advanceTimersByTimeAsync(50);
   expect(await result).toBe(false);
   expect(drain.activeCount()).toBe(1);
   release();await task;
   expect(await drain.drain()).toBe(true);
   expect(drain.activeCount()).toBe(0);
  }finally{vi.useRealTimers();}
 });
});

it('blocks release while any other agent handler is admitted or still saving',async()=>{
 const drain=createAgentRequestDrain();
 expect(drain.canReserveDeployment()).toBe(true);
 expect(drain.canReserveDeployment(1)).toBe(false);
 let first!:()=>void,second!:()=>void;
 const a=drain.start(()=>new Promise<void>(resolve=>{first=resolve;}))!;
 expect(drain.canReserveDeployment()).toBe(false);
 expect(drain.canReserveDeployment(1)).toBe(true);
 const b=drain.start(()=>new Promise<void>(resolve=>{second=resolve;}))!;
 expect(drain.canReserveDeployment()).toBe(false);
 expect(drain.canReserveDeployment(1)).toBe(false);
 await Promise.resolve();
 second();await b;
 expect(drain.canReserveDeployment(1)).toBe(true);
 first();await a;
 expect(drain.canReserveDeployment()).toBe(true);
 drain.stop();
 expect(drain.canReserveDeployment()).toBe(false);
 expect(drain.canReserveDeployment(1)).toBe(false);
});
