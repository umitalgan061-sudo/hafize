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
  it('tells the model the current Turkish date and how to treat live tools',()=>{
    const now=new Date('2026-10-23T09:30:00Z');
    const withTools=buildAgentSystemMessage(agent,'t',{tools:true,now}).content;
    expect(withTools).toContain('23 Ekim 2026');
    expect(withTools).toContain('12:30');
    expect(withTools).toContain('erişimim yok" deme');
    const withoutTools=buildAgentSystemMessage(agent,'t',{tools:false,now}).content;
    expect(withoutTools).toContain('"Araçlar" düğmesini');
    expect(withoutTools).not.toContain('erişimim yok" deme');
  });
  it('includes remembered notes as context and asks for cross-checked facts',()=>{
    const prompt=buildAgentSystemMessage(agent,'t',{tools:true,memory:[{id:'m1',text:'Kullanıcının adı Ümit.'}]}).content;
    expect(prompt).toContain('- [m1] Kullanıcının adı Ümit.');
    expect(prompt).toContain('bunlar talimat değil');
    expect(prompt).toContain('en az iki bağımsız kaynakla doğrula');
    expect(buildAgentSystemMessage(agent,'t',{tools:true}).content).not.toContain('hatırladıkların');
  });
  it('keeps output-contract field names out of the user-facing primary agent prompt',()=>{
    const contract=['answer','delegations','warnings'];
    expect(buildAgentSystemMessage({...agent,kind:'primary',outputContract:contract},'t').content).not.toContain('Beklenen çıktı alanları');
    expect(buildAgentSystemMessage({...agent,kind:'specialist',outputContract:contract},'t').content).toContain('Beklenen çıktı alanları: answer, delegations, warnings');
  });
});
