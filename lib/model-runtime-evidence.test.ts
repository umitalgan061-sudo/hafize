import {it,expect} from 'vitest';
import {openHafizeDb} from './hafize-db.ts';
import {createRuntimeEvidence} from './model-runtime-evidence.ts';
it('reorders only verified candidates using recent aggregate outcomes and ages out failures',()=>{
 const db=openHafizeDb(':memory:');let time=100000000;
 const evidence=createRuntimeEvidence(db,['a','b','c'],()=>time);
 for(let i=0;i<7;i++)evidence.record({model:'a',outcome:'provider_failure',latencyMs:1});
 expect(evidence.reorder(['a','b'])).toEqual(['a','b']);
 evidence.record({model:'a',outcome:'headers_ok',latencyMs:100});
 evidence.record({model:'c',outcome:'headers_ok',latencyMs:5});
 expect(evidence.reorder(['a','b'])).toEqual(['b','a']);
 expect(evidence.summary().find(r=>r.model==='a')).toMatchObject({attempts:8,headersOk:1,failures:7,meanHeaderMs:100});
 expect(createRuntimeEvidence(db,['a','b','c'],()=>time).reorder(['a','b'])).toEqual(['b','a']);
 time+=86400000;expect(evidence.reorder(['a','b'])).toEqual(['a','b']);db.close();
});
