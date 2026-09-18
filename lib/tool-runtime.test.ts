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
});
