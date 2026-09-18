// @ts-ignore Legacy credential policy remains shared during migration.
import { containsPlaintextCredential } from './plaintext-credential-policy.mjs';
export const MAX_DELEGATED_CONTENT_CHARS=32_768;
export const MAX_DELEGATED_ERROR_CHARS=120;
const SUCCESS_KEYS=new Set(['ok','content']),FAILURE_KEYS=new Set(['ok','error']),ERROR_CODE=/^[A-Z][A-Z0-9_]{1,119}$/;
type DescriptorMap=Record<string,PropertyDescriptor>;
type Invalid=Readonly<{ok:false;error:'DELEGATED_RESULT_INVALID';reason:string}>;
const invalid=(reason:string):Invalid=>Object.freeze({ok:false,error:'DELEGATED_RESULT_INVALID',reason});
function inspect(value:unknown):{ok:true;descriptors:DescriptorMap}|Invalid{
  if(!value||typeof value!=='object'||Array.isArray(value))return invalid('record');
  try{
    const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)return invalid('prototype');
    const descriptors=Object.getOwnPropertyDescriptors(value) as DescriptorMap;
    for(const descriptor of Object.values(descriptors))if(!Object.prototype.hasOwnProperty.call(descriptor,'value'))return invalid('accessor');
    return Object.freeze({ok:true,descriptors});
  }catch{return invalid('introspection');}
}
const value=(descriptors:DescriptorMap,key:string)=>Object.prototype.hasOwnProperty.call(descriptors,key)?descriptors[key]!.value:undefined;
const exact=(descriptors:DescriptorMap,allowed:ReadonlySet<string>)=>{const keys=Object.keys(descriptors);return keys.length===allowed.size&&keys.every((key)=>allowed.has(key));};
export function normalizeDelegatedAgentResult(input:unknown){
  const checked=inspect(input);if(!checked.ok)return checked;
  const {descriptors}=checked;
  if(value(descriptors,'ok')===true){
    if(!exact(descriptors,SUCCESS_KEYS))return invalid('success_shape');
    const content=value(descriptors,'content');
    if(typeof content!=='string')return invalid('content_type');
    if(content.length>MAX_DELEGATED_CONTENT_CHARS)return invalid('content_size');
    if(containsPlaintextCredential(content))return invalid('content_credential');
    return Object.freeze({ok:true as const,result:Object.freeze({ok:true as const,content})});
  }
  if(value(descriptors,'ok')===false){
    if(!exact(descriptors,FAILURE_KEYS))return invalid('failure_shape');
    const error=value(descriptors,'error');
    if(typeof error!=='string'||error.length<2||error.length>MAX_DELEGATED_ERROR_CHARS)return invalid('error_size');
    if(!ERROR_CODE.test(error))return invalid('error_format');
    return Object.freeze({ok:true as const,result:Object.freeze({ok:false as const,error})});
  }
  return invalid('ok');
}
