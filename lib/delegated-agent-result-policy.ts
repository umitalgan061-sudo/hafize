import { containsPlaintextCredential } from './plaintext-credential-policy.mjs';

export const MAX_DELEGATED_CONTENT_CHARS = 32_768;
export const MAX_DELEGATED_ERROR_CHARS = 120;

const SUCCESS_KEYS = new Set(['ok','content']);
const FAILURE_KEYS = new Set(['ok','error']);
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,119}$/;

type DescriptorMap = Record<string, PropertyDescriptor>;
type Invalid = Readonly<{ ok: false; error: 'DELEGATED_RESULT_INVALID'; reason: string }>;

function invalid(reason: string): Invalid { return Object.freeze({ ok:false,error:'DELEGATED_RESULT_INVALID',reason }); }
function inspectDataRecord(value: unknown): { ok: true; descriptors: DescriptorMap } | Invalid {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('record');
  let prototype: object | null;
  let descriptors: DescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return invalid('prototype');
    descriptors = Object.getOwnPropertyDescriptors(value) as DescriptorMap;
  } catch { return invalid('introspection'); }
  for (const descriptor of Object.values(descriptors)) if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return invalid('accessor');
  return Object.freeze({ ok:true, descriptors });
}
function descriptorValue(descriptors: DescriptorMap, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(descriptors,key) ? descriptors[key]!.value : undefined;
}
function exactKeys(descriptors: DescriptorMap, allowed: ReadonlySet<string>): boolean {
  const keys=Object.keys(descriptors); return keys.every((key)=>allowed.has(key)) && keys.length===allowed.size;
}
export function normalizeDelegatedAgentResult(value: unknown):
  | Readonly<{ ok:true; result: Readonly<{ ok:true; content:string }> }>
  | Readonly<{ ok:true; result: Readonly<{ ok:false; error:string }> }>
  | Invalid {
  const inspected=inspectDataRecord(value);
  if (!inspected.ok) return inspected;
  const {descriptors}=inspected;
  const ok=descriptorValue(descriptors,'ok');
  if (ok===true) {
    if(!exactKeys(descriptors,SUCCESS_KEYS)) return invalid('success_shape');
    const content=descriptorValue(descriptors,'content');
    if(typeof content!=='string') return invalid('content_type');
    if(content.length>MAX_DELEGATED_CONTENT_CHARS) return invalid('content_size');
    if(containsPlaintextCredential(content)) return invalid('content_credential');
    return Object.freeze({ok:true,result:Object.freeze({ok:true,content})});
  }
  if(ok===false) {
    if(!exactKeys(descriptors,FAILURE_KEYS)) return invalid('failure_shape');
    const error=descriptorValue(descriptors,'error');
    if(typeof error!=='string'||error.length<2||error.length>MAX_DELEGATED_ERROR_CHARS) return invalid('error_size');
    if(!ERROR_CODE_PATTERN.test(error)) return invalid('error_format');
    return Object.freeze({ok:true,result:Object.freeze({ok:false,error})});
  }
  return invalid('ok');
}
