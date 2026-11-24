import {describe,it,expect} from 'vitest';
import {summarize} from '../scripts/daily-domain-quality.mjs';
describe('domain quality evidence',()=>{
 it('preserves failed evidence and distinguishes untested areas',()=>{
  const rows=summarize({testResults:[{name:'/repo/lib/voice-engine.test.ts',status:'passed',assertionResults:[{status:'passed'},{status:'skipped'}]},{name:'/repo/lib/model-router.test.ts',status:'failed',assertionResults:[{status:'failed'}]}]});
  expect(rows.find(x=>x.id==='voice')).toMatchObject({state:'tested',passed:1,other:1});
  expect(rows.find(x=>x.id==='models')).toMatchObject({state:'failed',failed:1});
  expect(rows.find(x=>x.id==='memory')).toMatchObject({state:'unmeasured',passed:0});
 });
 it('marks missing report as unmeasured',()=>expect(summarize(null).every(x=>x.state==='unmeasured')).toBe(true));
});
