import { describe, expect, it } from 'vitest';
import { normalizeToolCall, parseToolArguments, sanitizeToolError, TOOL_CALL_LIMITS } from './tool-call-boundary.ts';

describe('tool call boundary',()=>{
  it('normalizes valid calls',()=>{
    const call=normalizeToolCall({id:'c1',function:{name:'runtime_status',arguments:'{}'}});
    expect(call.function.name).toBe('runtime_status');
    expect(call.type).toBe('function');
  });
  it('rejects malformed calls',()=>{
    expect(()=>normalizeToolCall(null)).toThrow('INVALID_TOOL_CALL');
    expect(()=>normalizeToolCall({id:'c'})).toThrow('INVALID_TOOL_NAME');
    expect(()=>normalizeToolCall({id:'c',function:{name:'x',arguments:'x'.repeat(16_385)}})).toThrow('TOOL_ARGUMENTS_TOO_LARGE');
  });
  it('reserves large bounded file content for the GitHub App editor only',()=>{
    const large = JSON.stringify({ operation: 'file', content: 'x'.repeat(20_000) });
    const sourceCall = { id: 'cGithub', function: { name: 'github_develop', arguments: large } };
    expect(normalizeToolCall(sourceCall).function.name).toBe('github_develop');
    expect(parseToolArguments(large, 'github_develop')).toMatchObject({ operation: 'file' });
    expect(() => normalizeToolCall({ id: 'c2', function: { name: 'runtime_status', arguments: large } })).toThrow('TOOL_ARGUMENTS_TOO_LARGE');
    expect(() => parseToolArguments(large)).toThrow('TOOL_ARGUMENTS_TOO_LARGE');
    const tooLarge = JSON.stringify({ content: 'x'.repeat(128 * 1024) });
    expect(() => normalizeToolCall({ id: 'c3', function: { name: 'github_develop', arguments: tooLarge } })).toThrow('TOOL_ARGUMENTS_TOO_LARGE');
    expect(TOOL_CALL_LIMITS.maxGitHubDevelopArgumentsLength).toBe(128 * 1024);
  });
  it('parses only JSON records',()=>{
    expect(parseToolArguments('{"a":"b"}')).toEqual({a:'b'});
    expect(parseToolArguments('')).toEqual({});
    expect(()=>parseToolArguments('[]')).toThrow('INVALID_TOOL_ARGUMENTS');
  });
  it('sanitizes errors and keeps limits',()=>{
    const result=sanitizeToolError({code:' X ',message:'\nsecret\n',status:503});
    expect(result.code).toBe('X');expect(result.message).toBe('secret');expect(result.status).toBe(503);
    expect(TOOL_CALL_LIMITS.maxArgumentsLength).toBe(16_384);
  });
});
