import { describe, expect, it } from 'vitest';
import { classifyRequestFailure } from './request-failure.ts';

function response(overrides:Record<string,unknown>={}):any{
  const headers=new Map<string,string>();
  return {
    destroyed:false,writableEnded:false,closed:false,headersSent:false,
    setHeader:(name:string,value:string)=>headers.set(name,value),
    getHeader:(name:string)=>headers.get(name),
    writeHead:()=>{},write:()=>true,end:()=>{},
    ...overrides
  };
}

describe('request failure boundary',()=>{
  it('classifies open responses as json',()=>{
    expect(classifyRequestFailure(response(),new Error('x'))).toBe('json');
  });
  it('detects client aborts',()=>{
    expect(classifyRequestFailure(response(),Object.assign(new Error('x'),{code:'ECONNRESET'}))).toBe('aborted');
  });
  it('detects already sent responses',()=>{
    expect(classifyRequestFailure(response({headersSent:true}),new Error('x'))).toBe('stream');
  });
  it('detects closed responses first',()=>{
    expect(classifyRequestFailure(response({destroyed:true}),new Error('x'))).toBe('closed');
  });
});
