// @ts-ignore Transitional dependency.
import { containsPlaintextCredential, isPlaintextCredentialField } from './plaintext-credential-policy.ts';

const MAX_DEPTH=8,MAX_NODES=2_000,MAX_STRING_LENGTH=256*1024;
export class ToolExecutionResultPolicyError extends Error{
  readonly code:string;readonly status=403;
  constructor(code='TOOL_RESULT_UNSAFE'){super(code);this.name='ToolExecutionResultPolicyError';this.code=code;}
}
function inspectString(value:string){if(value.length>MAX_STRING_LENGTH)throw new ToolExecutionResultPolicyError('TOOL_RESULT_COMPLEXITY_BLOCKED');if(containsPlaintextCredential(value))throw new ToolExecutionResultPolicyError('TOOL_RESULT_CREDENTIAL_BLOCKED');}
function inspectValue(value:unknown,state:{seen:Set<object>;nodes:number},depth=0):void{
  if(++state.nodes>MAX_NODES)throw new ToolExecutionResultPolicyError('TOOL_RESULT_COMPLEXITY_BLOCKED');
  if(value==null)return;
  if(typeof value==='string'){inspectString(value);return;}
  if(typeof value!=='object')return;
  if(depth>MAX_DEPTH)throw new ToolExecutionResultPolicyError('TOOL_RESULT_COMPLEXITY_BLOCKED');
  const object=value as object;
  if(state.seen.has(object))return;state.seen.add(object);
  if(Array.isArray(value)){for(const item of value)inspectValue(item,state,depth+1);return;}
  let prototype:Object|null=null;let descriptors:Record<string,PropertyDescriptor>;
  try{prototype=Object.getPrototypeOf(value);descriptors=Object.getOwnPropertyDescriptors(value) as Record<string,PropertyDescriptor>;}catch{throw new ToolExecutionResultPolicyError('TOOL_RESULT_INSPECTION_FAILED');}
  if(prototype!==Object.prototype&&prototype!==null)throw new ToolExecutionResultPolicyError('TOOL_RESULT_SHAPE_BLOCKED');
  for(const[key,descriptor]of Object.entries(descriptors)){
    if(!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw new ToolExecutionResultPolicyError('TOOL_RESULT_ACCESSOR_BLOCKED');
    if(isPlaintextCredentialField(key,descriptor.value))throw new ToolExecutionResultPolicyError('TOOL_RESULT_CREDENTIAL_FIELD_BLOCKED');
    inspectValue(descriptor.value,state,depth+1);
  }
}
export function assertSafeToolExecutionValue(value:unknown):unknown{inspectValue(value,{seen:new Set(),nodes:0});return value;}
export function projectSafeToolExecutionResult<T>(result:{readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string}){
  if(!result||result.ok!==true)return result;
  try{assertSafeToolExecutionValue(result.value);return result;}catch(error){if(error instanceof ToolExecutionResultPolicyError)return{ok:false as const,error:error.code};return{ok:false as const,error:'TOOL_RESULT_UNSAFE'};}
}