import { describe, expect, it, vi } from 'vitest';
import { createModelLab, modelLabCommand, modelTaskKind, formatModelLabStatus } from './model-lab.ts';
const a = 'nvidia/example-a', b = 'nvidia/example-b';
const reply = (message: unknown) => new Response(JSON.stringify({ choices: [{ message }] }));
const valid = { content: JSON.stringify({ capital: 'Ankara', math: 383, code: 12 }) };
const tool = { tool_calls: [{ function: { name: 'benchmark_echo', arguments: '{"value":42}' } }] };
describe('NVIDIA model lab', () => {
  it('discovers exact model IDs without treating listing as proof of access', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: a }, { id: b }, { id: 'bad' }] })));
    const lab = createModelLab({ allowed: [a], request });
    expect((await lab.discover()).catalog?.ids).toEqual([a,b]);
    expect(lab.status().results).toEqual([]);
    expect(lab.preferred('general',[a,b])).toEqual([]);
    await expect(lab.probe(b)).rejects.toThrow('MODEL_LAB_MODEL_NOT_ALLOWED');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('tests the exact model with only synthetic inputs and caches evidence', async () => {
    const request = vi.fn(async (_path, body) => {
      expect(body.model).toBe(a);
      return reply(body.tools ? tool : valid);
    });
    const lab = createModelLab({ allowed: [a,b], request });
    const row = await lab.probe(a);
    expect(row).toMatchObject({ status: 'passed', chat: true, turkish: true, reasoning: true, coding: true, tools: true, toolProbeStatus: 'passed', requests: 2 });
    expect(lab.preferred('coding',[b,a])).toEqual([a]);
    expect(await lab.probe(a)).toEqual(row);
    expect(request).toHaveBeenCalledTimes(2);
    expect(formatModelLabStatus(lab.status())).toContain('genel zekâ sıralaması değildir');
  });
  it('separates text success from failed tool calling and ignores wrong arguments', async () => {
    const lab = createModelLab({ allowed: [a], request: async (_path, body) => reply(body?.tools ? { tool_calls: [{ function: { name:'benchmark_echo',arguments:'{"value":43}' } }] } : valid) });
    expect(await lab.probe(a)).toMatchObject({ status: 'passed', tools: false, toolProbeStatus: 'invalid_response' });
    expect(lab.preferred('agent',[a])).toEqual([]);
  });
  it('does not route failed quota models as verified', async () => {
    const lab = createModelLab({ allowed: [a], request: async () => new Response('', {status:429}) });
    expect(await lab.probe(a)).toMatchObject({status:'rate_limited',chat:false,requests:1});
    expect(lab.preferred('general',[a])).toEqual([]);
  });
  it('bounds API requests across models and expires benchmark evidence', async () => {
    let time = 1000000;
    const ids = Array.from({length:7},(_,i)=>'nvidia/test-'+i);
    const lab = createModelLab({ allowed:ids, now:()=>time, request:async (_path,body)=>reply(body?.tools?tool:valid) });
    for (const model of ids.slice(0,6)) await lab.probe(model);
    expect(lab.status().requestsRemaining).toBe(0);
    await expect(lab.probe(ids[6]!)).rejects.toThrow('MODEL_LAB_BUDGET');
    time += 24*60*60_000+1;
    expect(lab.preferred('agent',ids)).toEqual([]);
    expect(lab.status().requestsRemaining).toBe(12);
  });
  it('cancels without recording false evidence', async () => {
    const controller = new AbortController(); controller.abort();
    const request = vi.fn(async()=>reply(valid));
    const lab=createModelLab({allowed:[a],request});
    await expect(lab.probe(a,controller.signal)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    expect(lab.status().results).toEqual([]);
  });
  it('only routes explicit standalone lab commands and classifies task types',()=>{
    expect(modelLabCommand('Model testi: nvidia/example-a')).toEqual({action:'probe',model:a});
    expect(modelLabCommand('NVIDIA modellerini listele')).toEqual({action:'discover'});
    expect(modelLabCommand('Model laboratuvarı')).toEqual({action:'status'});
    expect(modelLabCommand('Model testi: https://example.com/x')).toBeNull();
    expect(modelTaskKind({messages:[{role:'user',content:'GitHub commit oluştur'}]})).toBe('coding');
    expect(modelTaskKind({messages:[{role:'user',content:'Selam'}]})).toBe('fast');
    expect(modelTaskKind({tools:[{}]})).toBe('agent');
  });
});
