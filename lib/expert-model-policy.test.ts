
import {describe,it,expect} from 'vitest';
import {loadAgentRegistry} from './agent-runtime.ts';
import {EXPERT_MODEL_TASKS,expertModelTask} from './expert-model-policy.ts';
describe('all specialist agents have a routing profile',()=>{it('covers every registered specialist and rejects unknown identities',async()=>{const registry=await loadAgentRegistry();expect(Object.keys(EXPERT_MODEL_TASKS).sort()).toEqual(registry.agents.filter(a=>a.kind==='specialist').map(a=>a.id).sort());expect(expertModelTask('expert-coder')).toBe('coding');expect(expertModelTask('constructor')).toBeUndefined();expect(expertModelTask('hafize-general')).toBeUndefined();});});
