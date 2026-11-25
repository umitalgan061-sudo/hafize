const ASSIGNMENT=/((?:^|[^a-z0-9])(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|auth[_ -]?token|password|passwd|client[_ -]?secret|secret)(?![a-z0-9]))\s*(?:=|:)\s*["']?[^\s"']{6,}/i;
const AUTHORIZATION=/\b(?:authorization|proxy-authorization)\s*:\s*(?:bearer|basic)\s+[a-z0-9._~+\/=:-]{8,}/i;
const KNOWN=/\b(?:github_pat_[a-z0-9_]{20,}|gh[pousr]_[a-z0-9]{30,}|nvapi-[a-z0-9_-]{20,})\b/i;
const GOOGLE=/(?:^|[^a-z0-9._~-])ya29\.[a-z0-9._~-]{20,}(?=$|[^a-z0-9._~-])/i;
const PRIVATE_KEY=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
const FIELDS=new Set(['apikey','accesstoken','refreshtoken','authtoken','authorization','proxyauthorization','password','passwd','clientsecret','secret']);
const fieldName=(value:unknown)=>typeof value==='string'?value.toLowerCase().replace(/[^a-z0-9]/g,''):'';
export function isPlaintextCredentialField(name:unknown,value:unknown):boolean{return FIELDS.has(fieldName(name))&&typeof value==='string'&&value.trim().length>0;}
export function containsPlaintextCredential(value:unknown):boolean{return typeof value==='string'&&(ASSIGNMENT.test(value)||AUTHORIZATION.test(value)||KNOWN.test(value)||GOOGLE.test(value)||PRIVATE_KEY.test(value));}
const REDACTABLE=[ASSIGNMENT,AUTHORIZATION,KNOWN,GOOGLE,PRIVATE_KEY].map((pattern)=>new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'));
// Untrusted text (e.g. a fetched web page) is redacted rather than rejected, so one sample
// "api_key=..." line in documentation does not make the whole page unreadable.
export function redactPlaintextCredentials(value:string):string{let output=value;for(const pattern of REDACTABLE)output=output.replace(pattern,'[gizlendi]');return output;}
export const PLAINTEXT_CREDENTIAL_POLICY=Object.freeze({fieldNames:Object.freeze([...FIELDS]),patterns:['assignment','authorization','known-token','google-oauth','private-key'] as const});
/** Source-only exception for exact nonliteral runtime references, not arbitrary
 * assignments. The generic credential guard remains unchanged for other inputs.
 * Never exempt a line containing an actual value, suffix, comment or extra code. */
const SAFE_SOURCE_REFERENCES=new Set([
 "const NVIDIA_API_KEY = gateway?.apiKey ?? (process.env.NVIDIA_API_KEY || '');",
 "const SCHEDULE_AUTH_TOKEN = process.env.HAFIZE_SCHEDULE_AUTH_TOKEN || '';",
 "apiKey: process.env.NVIDIA_API_KEY || '',",
 "const authToken = typeof token === 'string' ? token.trim() : '';"
]);
export function containsSourcePlaintextCredential(value:unknown,path:string):boolean{
 if(typeof value!=='string'||! /\.(?:[cm]?[jt]sx?)$/i.test(path))return containsPlaintextCredential(value);
 // The independent token/private-key/Authorization detectors still scan the full original.
 if(AUTHORIZATION.test(value)||KNOWN.test(value)||GOOGLE.test(value)||PRIVATE_KEY.test(value))return true;
 const candidate=value.split(/\r?\n/).map(line=>SAFE_SOURCE_REFERENCES.has(line.trim())?'':line).join('\n');
 return containsPlaintextCredential(candidate);
}
