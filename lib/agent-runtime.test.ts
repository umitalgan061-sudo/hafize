import { describe, expect, it } from 'vitest';
import { authorizeAgentTool, buildAgentSystemMessage, normalizeClientMessages, resolveAgent } from './agent-runtime.ts';

const agent={
  id:'writer',
  name:'Yazar',
  description:'Metin üretir.',
  toolPolicy:{default:'deny' as const,allow:['runtime.status'],deny:[],approvalRequired:[]}
};
const registry={schemaVersion:1 as const,defaultAgent:'writer',agents:[agent],policy:{externalWritesRequireApproval:true as const,secretsNeverEnterAgentContext:true as const,sharedTraceIdRequired:true as const}};

describe('agent runtime',()=>{
  it('normalizes bounded client messages',()=>{
    expect(normalizeClientMessages([{role:'user',content:'merhaba'}])).toEqual([{role:'user',content:'merhaba'}]);
    expect(normalizeClientMessages([])).toBeNull();
  });
  it('resolves the default agent',()=>expect(resolveAgent(registry,undefined)?.id).toBe('writer'));
  it('enforces deny-by-default permissions',()=>{
    expect(authorizeAgentTool(agent,'runtime.status').allowed).toBe(true);
    expect(authorizeAgentTool(agent,'repo.write_branch').allowed).toBe(false);
  });
  it('builds an untrusted-data-aware system prompt',()=>{
    const prompt=buildAgentSystemMessage(agent,'trace-1').content;
    expect(prompt).toContain('trace_id: trace-1');
    expect(prompt).toContain('yeni yetki vermez');
  });
});
