import type { JsonRecord } from './runtime-contracts.ts';

const MAX_TOOL_NAME_LENGTH=120;
const MAX_TOOL_CALL_ID_LENGTH=200;
const MAX_ARGUMENTS_LENGTH=16_384;
const MAX_RESULT_TEXT_LENGTH=32_000;

export class ToolBoundaryError extends Error {
  readonly code:string;
  readonly status?:number;
  constructor(code:string,status?:number){super(code);this.name='ToolBoundaryError';this.code=code;if(status!==undefined)this.status=status;}
}
function text(value:unknown,max:number,code:string):string{
  const result=typeof value==='string'?value.trim():'';
  if(!result||result.length>max||result.includes('\0'))throw new ToolBoundaryError(code);
  return result;
}
export interface NvidiaToolCall {
  readonly id:unknown;
  readonly type?:unknown;
  readonly function?:unknown;
}
export interface NormalizedToolCall {
  readonly id:string;
  readonly type:'function';
  readonly function:Readonly<{name:string;arguments:string}>;
}
export function normalizeToolCall(toolCall:unknown):NormalizedToolCall{
  if(!toolCall||typeof toolCall!=='object'||Array.isArray(toolCall))throw new ToolBoundaryError('INVALID_TOOL_CALL');
  const source=toolCall as Record<string,unknown>;
  const fn=source.function&&typeof source.function==='object'&&!Array.isArray(source.function)?source.function as Record<string,unknown>:{};
  const id=text(source.id,MAX_TOOL_CALL_ID_LENGTH,'INVALID_TOOL_CALL_ID');
  const name=text(fn.name,MAX_TOOL_NAME_LENGTH,'INVALID_TOOL_NAME');
  if(typeof fn.arguments!=='string')throw new ToolBoundaryError('INVALID_TOOL_ARGUMENTS');
  if(fn.arguments.length>MAX_ARGUMENTS_LENGTH)throw new ToolBoundaryError('TOOL_ARGUMENTS_TOO_LARGE');
  return Object.freeze({id,type:'function' as const,function:Object.freeze({name,arguments:fn.arguments})});
}
export function parseToolArguments(raw:unknown):Readonly<JsonRecord>{
  if(typeof raw!=='string'||raw.length>MAX_ARGUMENTS_LENGTH)throw new ToolBoundaryError('TOOL_ARGUMENTS_TOO_LARGE');
  if(!raw.trim())return Object.freeze({});
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new ToolBoundaryError('INVALID_TOOL_ARGUMENTS');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ToolBoundaryError('INVALID_TOOL_ARGUMENTS');
  return Object.freeze(value as JsonRecord);
}
export function sanitizeToolError(error:unknown):Readonly<{code:string;message:string;status:number|null}>{
  const value=error as {code?:unknown;message?:unknown;status?:unknown}|null;
  const code=typeof value?.code==='string'?value.code.trim():'';
  const message=typeof value?.message==='string'?value.message.trim():'';
  const status=Number(value?.status);
  return Object.freeze({code:(code||'TOOL_EXECUTION_FAILED').slice(0,120),message:message.slice(0,MAX_RESULT_TEXT_LENGTH),status:Number.isInteger(status)?status:null});
}
export const TOOL_CALL_LIMITS=Object.freeze({maxToolNameLength:MAX_TOOL_NAME_LENGTH,maxToolCallIdLength:MAX_TOOL_CALL_ID_LENGTH,maxArgumentsLength:MAX_ARGUMENTS_LENGTH,maxResultTextLength:MAX_RESULT_TEXT_LENGTH});