import {authorizeAgentTool,type AgentRegistry} from './agent-runtime.ts';
import {cardFor,validateJsonSchema} from './expert-registry.ts';
import {expertModelTask} from './expert-model-policy.ts';
const REQUIRED=Object.freeze({
 'agency-orchestrator':['agent.delegate'],
 'agency-minimal-engineer':['repo.read','test.run'],
 'agency-code-reviewer':['repo.read','pr.read'],
 'expert-researcher':['research.run','web.search'],
 'expert-coder':['code.run'],
 'expert-data-analyst':['code.run','diagram.render'],
 'expert-math':['code.run'],
 'expert-legal-tr':['research.run','web.read'],
 'expert-health':['research.run','web.read'],
 'expert-finance':['web.rates.read','code.run'],
 'expert-writer':[],
 'expert-vision':['vision.analyze']
} satisfies Record<string,readonly string[]>);
export type ExpertReadiness={agentId:string;passed:boolean;checks:{key:string;passed:boolean}[];mode:'offline_contract'};
export function auditExpertContracts(registry:AgentRegistry):ExpertReadiness[]{
 const ids=[...new Set([...Object.keys(REQUIRED),...registry.agents.filter(a=>a.kind==='specialist').map(a=>a.id)])];
 return ids.map(agentId=>{
  const agent=registry.agents.find(a=>a.id===agentId&&a.kind==='specialist');
  const checks:ExpertReadiness['checks']=[{key:'registered',passed:Boolean(agent)}];
  if(agent){
   const card=cardFor(agent);
   const add=(key:string,passed:boolean)=>checks.push({key,passed});
   add('model_profile',Boolean(expertModelTask(agentId)));
   add('mission',Boolean(agent.mission?.length&&agent.outputContract?.length));
   add('capabilities',card.capabilities.length>0);
   add('limits',Number.isFinite(card.slo.latencyP99Ms)&&card.slo.availability>0&&card.slo.availability<=1&&Number.isInteger(card.quota.callsPerDay)&&Number.isInteger(card.quota.tokensPerDay));
   add('input_contract',!validateJsonSchema({task:'Sentetik denetim'},card.inputSchema).length&&validateJsonSchema({},card.inputSchema).length>0);
   const output=card.outputSchema.type==='object'?{summary:'Sentetik denetim',sources:[],results:[]}: 'Sentetik denetim';
   add('output_contract',!validateJsonSchema(output,card.outputSchema).length&&validateJsonSchema(null,card.outputSchema).length>0);
   for(const permission of REQUIRED[agentId as keyof typeof REQUIRED]??[])add('allow:'+permission,authorizeAgentTool(agent,permission).allowed);
   for(const permission of ['secret.read','repo.delete','repo.merge','external.send','external.write','repo.write_branch','shell.run'])add('deny_unapproved:'+permission,!authorizeAgentTool(agent,permission).allowed);
  }
  return {agentId,checks,passed:checks.every(c=>c.passed),mode:'offline_contract'};
 });
}
