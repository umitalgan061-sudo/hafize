import {it,expect} from 'vitest';
import {loadAgentRegistry} from './agent-runtime.ts';
import {auditExpertContracts} from './expert-readiness.ts';
it('checks all twelve specialists without contacting a provider or executing tools',async()=>{
 const registry=await loadAgentRegistry();const report=auditExpertContracts(registry);
 expect(report).toHaveLength(12);expect(report.filter(r=>!r.passed)).toEqual([]);
 expect(report.every(r=>r.mode==='offline_contract')).toBe(true);
});
it('detects missing experts and removed critical capability permissions',async()=>{
 const registry=await loadAgentRegistry();
 const modified={...registry,agents:registry.agents.filter(a=>a.id!=='expert-writer').map(a=>a.id==='expert-math'?{...a,toolPolicy:{...a.toolPolicy,allow:['trace.write']}}:a)};
 const report=auditExpertContracts(modified);
 expect(report.find(r=>r.agentId==='expert-writer')?.passed).toBe(false);
 expect(report.find(r=>r.agentId==='expert-math')?.checks).toContainEqual({key:'allow:code.run',passed:false});
});
