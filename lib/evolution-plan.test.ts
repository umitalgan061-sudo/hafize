import {it,expect} from 'vitest';
import {buildEvolutionPlan} from './evolution-plan.ts';
it('prioritizes actual failed contracts and reliability without proposing unchecked activation',()=>{
 const plan=buildEvolutionPlan({now:0,labAvailable:false,liveProbes:false,error:null,readiness:[{agentId:'expert-math',passed:false,mode:'offline_contract',checks:[{key:'model_profile',passed:false}]}],runtime:[{model:'a',attempts:8,headersOk:6,failures:2,streamFailures:0,meanHeaderMs:20}],catalogChanges:{addedCount:1,added:['vendor/new']},pendingModels:['a']});
 expect(plan.mode).toBe('recommendation_only');expect(plan.tasks.slice(0,3).map(x=>x.id)).toEqual(['model-lab-access','expert:expert-math','reliability:a']);
 expect(plan.tasks.find(x=>x.id==='catalog-review')?.acceptance).toContain('otomatik aday ekleme yapılmasın');
});
