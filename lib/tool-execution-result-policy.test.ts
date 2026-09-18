import { describe, expect, it } from 'vitest';
import { assertSafeToolExecutionValue, projectSafeToolExecutionResult, ToolExecutionResultPolicyError } from './tool-execution-result-policy.ts';

describe('tool execution result policy',()=>{
  it('accepts safe plain data',()=>{
    const value={ok:true,nested:{items:['a','b']}};
    expect(assertSafeToolExecutionValue(value)).toBe(value);
    expect(projectSafeToolExecutionResult({ok:true,value})).toEqual({ok:true,value});
  });
  it('blocks credential values',()=>{
    expect(()=>assertSafeToolExecutionValue({token:'nvapi-abcdefghijklmnopqrstuvwxyz'})).toThrow(ToolExecutionResultPolicyError);
  });
  it('blocks dangerous prototypes and accessors',()=>{
    expect(()=>assertSafeToolExecutionValue(Object.create({danger:true}))).toThrow('TOOL_RESULT_SHAPE_BLOCKED');
    const value={get secret(){return 'x'}};
    expect(()=>assertSafeToolExecutionValue(value)).toThrow('TOOL_RESULT_ACCESSOR_BLOCKED');
  });
  it('bounds graph complexity',()=>{
    expect(()=>assertSafeToolExecutionValue(Array.from({length:2100},()=>1))).toThrow('TOOL_RESULT_COMPLEXITY_BLOCKED');
  });
});
