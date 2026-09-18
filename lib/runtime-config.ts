export interface RuntimeEnvironment {
  readonly HOST?: unknown;
  readonly NODE_ENV?: unknown;
  readonly HAFIZE_AUTH_REQUIRED?: unknown;
  readonly HAFIZE_AUTH_TOKEN?: unknown;
  readonly HAFIZE_AUTH_SUBJECT?: unknown;
  readonly HAFIZE_AUTH_SESSION_TTL_SECONDS?: unknown;
  readonly HAFIZE_COOKIE_SECURE?: unknown;
  readonly HAFIZE_TRUST_PROXY?: unknown;
  readonly HAFIZE_CONNECTOR_AUTH_TOKEN?: unknown;
  readonly HAFIZE_CONNECTOR_AUTH_SUBJECT?: unknown;
  readonly HAFIZE_LOCAL_MODEL_ENABLED?: unknown;
  readonly HAFIZE_LOCAL_MODEL_BASE_URL?: unknown;
}

export interface RuntimeConfig {
  readonly host: string;
  readonly nodeEnv: string;
  readonly authRequired: boolean;
  readonly authToken: string;
  readonly authSubject: string;
  readonly sessionTtlSeconds: number;
  readonly cookieSecure: boolean;
  readonly trustProxy: boolean;
  readonly connectorAuthToken: string;
  readonly connectorAuthSubject: string;
  readonly localModelEnabled: boolean;
  readonly localModelBaseUrl: string;
}

const MAX_HOST=200;
const MAX_TOKEN=4096;
const MIN_TOKEN=32;
const DEFAULT_SESSION_TTL=7*86400;
const MAX_SESSION_TTL=30*86400;

function text(value:unknown,max:number):string{return typeof value==='string'?value.trim().slice(0,max):'';}
function bool(value:unknown,fallback:boolean):boolean{
  if(value==null||value==='')return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}
function integer(value:unknown,fallback:number,min:number,max:number):number{
  const parsed=Number.parseInt(value==null?'':String(value),10);
  return Number.isInteger(parsed)?Math.min(Math.max(parsed,min),max):fallback;
}
function token(value:unknown):string{
  const result=text(value,MAX_TOKEN);
  if(result && result.length<MIN_TOKEN)throw new Error('INVALID_RUNTIME_CONFIG:TOKEN_TOO_SHORT');
  if(result.length===MAX_TOKEN&&typeof value==='string'&&value.trim().length>MAX_TOKEN)throw new Error('INVALID_RUNTIME_CONFIG:TOKEN_TOO_LARGE');
  if(/\s/.test(result))throw new Error('INVALID_RUNTIME_CONFIG:TOKEN_WHITESPACE');
  return result;
}
function localUrl(value:unknown):string{
  const raw=text(value,300)||'http://127.0.0.1:11434';
  let url:URL;
  try{url=new URL(raw);}catch{throw new Error('INVALID_RUNTIME_CONFIG:LOCAL_MODEL_URL');}
  if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost','::1'].includes(url.hostname)||url.username||url.password||url.search||url.hash){
    throw new Error('INVALID_RUNTIME_CONFIG:LOCAL_MODEL_URL');
  }
  return url.href.replace(/\/+$/,'');
}

export function parseRuntimeConfig(env:RuntimeEnvironment={}):RuntimeConfig{
  const host=text(env.HOST,MAX_HOST)||'127.0.0.1';
  const nodeEnv=text(env.NODE_ENV,32)||'development';
  const authRequired=bool(env.HAFIZE_AUTH_REQUIRED,nodeEnv==='production'||host!=='127.0.0.1');
  const authToken=token(env.HAFIZE_AUTH_TOKEN);
  if(authRequired&&!authToken)throw new Error('HAFIZE_AUTH_TOKEN_REQUIRED_FOR_PUBLIC_RUNTIME');
  return Object.freeze({
    host,
    nodeEnv,
    authRequired,
    authToken,
    authSubject:text(env.HAFIZE_AUTH_SUBJECT,200)||'primary-user',
    sessionTtlSeconds:integer(env.HAFIZE_AUTH_SESSION_TTL_SECONDS,DEFAULT_SESSION_TTL,300,MAX_SESSION_TTL),
    cookieSecure:bool(env.HAFIZE_COOKIE_SECURE,nodeEnv==='production'),
    trustProxy:bool(env.HAFIZE_TRUST_PROXY,false),
    connectorAuthToken:token(env.HAFIZE_CONNECTOR_AUTH_TOKEN),
    connectorAuthSubject:text(env.HAFIZE_CONNECTOR_AUTH_SUBJECT,200),
    localModelEnabled:bool(env.HAFIZE_LOCAL_MODEL_ENABLED,false),
    localModelBaseUrl:localUrl(env.HAFIZE_LOCAL_MODEL_BASE_URL)
  });
}

export const RUNTIME_CONFIG_LIMITS=Object.freeze({
  minTokenLength:MIN_TOKEN,
  maxTokenLength:MAX_TOKEN,
  defaultSessionTtl:DEFAULT_SESSION_TTL,
  maxSessionTtl:MAX_SESSION_TTL,
  maxHostLength:MAX_HOST
});
