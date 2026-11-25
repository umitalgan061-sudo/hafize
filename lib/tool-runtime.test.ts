import { describe, expect, it } from 'vitest';
import { executeNvidiaToolCall, getAllowedNvidiaTools, listToolPermissions } from './tool-runtime.ts';

const agent={id:'a',name:'Agent',toolPolicy:{default:'deny' as const,allow:['runtime.status'],deny:[],approvalRequired:[]}};
const context={traceId:'t',agent,registry:{agents:[agent]},nvidiaConfigured:true,githubReadConfigured:false};

describe('typed tool runtime',()=>{
  it('publishes only authorized available tools',()=>{
    const names=getAllowedNvidiaTools(agent,context).map((tool)=>tool.function.name);
    expect(names).toContain('runtime_status');
    expect(names).not.toContain('github_read_file');
  });
  it('keeps a stable permission catalog',()=>{
    expect(listToolPermissions().some((item)=>item.name==='runtime_status')).toBe(true);
  });
  it('executes valid runtime status safely',async()=>{
    const result=await executeNvidiaToolCall(agent,{id:'c1',function:{name:'runtime_status',arguments:'{}'}},context);
    expect(result.ok).toBe(true);
    if(result.ok)expect(result.value).toMatchObject({status:'ok',traceId:'t',agentId:'a'});
  });
  it('rejects malformed and unauthorized calls',async()=>{
    const malformed=await executeNvidiaToolCall(agent,{id:'c1',function:{name:'runtime_status',arguments:'['}},context);
    expect(malformed).toMatchObject({ok:false});
    const unauthorized=await executeNvidiaToolCall(agent,{id:'c2',function:{name:'github_read_file',arguments:'{}'}},context);
    expect(unauthorized).toMatchObject({ok:false,error:'TOOL_NOT_AUTHORIZED'});
  });

  it('reports tool metadata and bounded duration', async () => {
    const result = await executeNvidiaToolCall(agent, {
      id: 'c3',
      function: { name: 'runtime_status', arguments: '{}' }
    }, context);
    expect(result).toMatchObject({ ok: true, tool: 'runtime_status' });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    const runtime = listToolPermissions().find((item) => item.name === 'runtime_status');
    expect(runtime).toMatchObject({ kind: 'diagnostic', timeoutMs: 10_000 });
  });

  it('does not expose unavailable connector tools', () => {
    const tools = getAllowedNvidiaTools(agent, context);
    expect(tools.map((tool) => tool.function.name)).not.toContain('canva_read');
    expect(tools.map((tool) => tool.function.name)).not.toContain('gmail_read');
  });

  it('offers the constrained GitHub development tool only when both policy and service are present', async () => {
    const developer = { id: 'dev', name: 'Developer', toolPolicy: { default: 'deny' as const, allow: ['repo.development'], deny: [], approvalRequired: [] } };
    const service = async () => ({ action: 'branch', branch: 'hafize/auto-safe' });
    const developerContext = { ...context, agent: developer, services: { githubDevelopment: service } };
    expect(getAllowedNvidiaTools(developer, developerContext).map((tool) => tool.function.name)).toContain('github_development');
    const result = await executeNvidiaToolCall(developer, {
      id: 'c5', function: { name: 'github_development', arguments: JSON.stringify({ action: 'branch', payload: { repository: 'owner/repo', branch: 'hafize/auto-safe', fromRef: 'main' } }) }
    }, developerContext);
    expect(result).toMatchObject({ ok: true, tool: 'github_development' });
  });

  it('keeps execution context immutable at the call site', async () => {
    const before = { ...context };
    await executeNvidiaToolCall(agent, {
      id: 'c4',
      function: { name: 'runtime_status', arguments: '{}' }
    }, context);
    expect(context).toEqual(before);
  });

});

it('carries authorized GitHub source content across the result boundary without leaking credentials',async()=>{
 const reader={...agent,toolPolicy:{...agent.toolPolicy,allow:['repo.read']}};
 const repository='owner/repo',path='server.ts';
 const line="const SCHEDULE_AUTH_TOKEN = process.env.HAFIZE_SCHEDULE_AUTH_TOKEN || '';";
 const call={id:'read-source',function:{name:'github_read_file',arguments:JSON.stringify({repository,path})}};
 const ctx={...context,agent:reader,registry:{agents:[reader]},githubReadConfigured:true};
 const good=await executeNvidiaToolCall(reader,call,{...ctx,githubReadFile:async()=>({repository,path,content:line})});
 expect(good).toMatchObject({ok:true,value:{content:line}});
 const bad=await executeNvidiaToolCall(reader,call,{...ctx,githubReadFile:async()=>({repository,path,content:line+'\nAPI_KEY=super-secret-value'})});
 expect(bad).toMatchObject({ok:false,error:'TOOL_RESULT_CREDENTIAL_BLOCKED'});
});
it('uses the existing larger GitHub development argument limit during runtime parsing',async()=>{
 const developer={...agent,toolPolicy:{...agent.toolPolicy,allow:['repo.write_request']}};
 const content='x'.repeat(20000);
 const args={operation:'file',repository:'owner/repo',branch:'hafize/auto-test',path:'example.ts',content,message:'test'};
 const result=await executeNvidiaToolCall(developer,{id:'large-file',function:{name:'github_develop',arguments:JSON.stringify(args)}},{...context,agent:developer,registry:{agents:[developer]},safeGitHubAutonomy:true,githubDevelopment:{enabled:()=>true,execute:async(input)=>({received:(input as {content:string}).content.length})}});
 expect(result).toMatchObject({ok:true,value:{received:20000}});
});
it('returns fixed action-specific inspection guidance without echoing invalid arguments',async()=>{
 const reader={...agent,toolPolicy:{...agent.toolPolicy,allow:['repo.read']}};
 const result=await executeNvidiaToolCall(reader,{id:'inspect',function:{name:'github_inspect',arguments:JSON.stringify({action:'repo',repository:'owner/repo',branch:'main'})}},{...context,agent:reader,registry:{agents:[reader]},githubReadConfigured:true,githubInspect:async()=>{throw Object.assign(new Error('invalid'),{code:'INVALID_GITHUB_ARGUMENTS',status:400});}});
 expect(result).toMatchObject({ok:false,error:'INVALID_GITHUB_ARGUMENTS',status:400,reason:expect.stringContaining('commits:ref/limit')});
});
