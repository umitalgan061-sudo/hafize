import {describe,it,expect} from 'vitest';
import {summarizeScheduleRuntime} from './schedule-runtime-card.ts';
import {readFileSync} from 'node:fs';
describe('restored schedule runtime and message animation',()=>{
 it('distinguishes missing from unknown and does not promise uptime',()=>{
  expect(summarizeScheduleRuntime(null).state).toBe('unknown');
  expect(summarizeScheduleRuntime({scheduleWorkerConfigured:false}).state).toBe('offline');
  expect(summarizeScheduleRuntime({scheduleWorkerConfigured:true}).state).toBe('partial');
  const full=summarizeScheduleRuntime({scheduleWorkerConfigured:true,scheduleStorageDurable:true,scheduleLeaseConfigured:true,scheduleApiConfigured:true});
  expect(full.state).toBe('configured');expect(full.summary).toContain('ayrıca doğrulanmalıdır');
 });
 it('animates only new messages, not the last message on every redraw',()=>{
  const css=readFileSync(new URL('../polish.css',import.meta.url),'utf8');
  expect(css).toContain('.message.is-new { animation: polishRise');expect(css).not.toContain('.message:last-child { animation: polishRise');
 });
});
