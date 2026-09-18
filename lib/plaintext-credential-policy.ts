const ASSIGNMENT=/((?:^|[^a-z0-9])(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|auth[_ -]?token|password|passwd|client[_ -]?secret|secret)(?![a-z0-9]))\s*(?:=|:)\s*["']?[^\s"']{6,}/i;
const AUTHORIZATION=/\b(?:authorization|proxy-authorization)\s*:\s*(?:bearer|basic)\s+[a-z0-9._~+\/=:-]{8,}/i;
const KNOWN=/\b(?:github_pat_[a-z0-9_]{20,}|gh[pousr]_[a-z0-9]{30,}|nvapi-[a-z0-9_-]{20,})\b/i;
const GOOGLE=/(?:^|[^a-z0-9._~-])ya29\.[a-z0-9._~-]{20,}(?=$|[^a-z0-9._~-])/i;
const PRIVATE_KEY=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
const FIELDS=new Set(['apikey','accesstoken','refreshtoken','authtoken','authorization','proxyauthorization','password','passwd','clientsecret','secret']);
const fieldName=(value:unknown)=>typeof value==='string'?value.toLowerCase().replace(/[^a-z0-9]/g,''):'';
export function isPlaintextCredentialField(name:unknown,value:unknown):boolean{return FIELDS.has(fieldName(name))&&typeof value==='string'&&value.trim().length>0;}
export function containsPlaintextCredential(value:unknown):boolean{return typeof value==='string'&&(ASSIGNMENT.test(value)||AUTHORIZATION.test(value)||KNOWN.test(value)||GOOGLE.test(value)||PRIVATE_KEY.test(value));}
export const PLAINTEXT_CREDENTIAL_POLICY=Object.freeze({fieldNames:Object.freeze([...FIELDS]),patterns:['assignment','authorization','known-token','google-oauth','private-key'] as const});