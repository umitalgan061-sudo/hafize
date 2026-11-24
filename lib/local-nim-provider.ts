// Local NVIDIA NIM / OpenAI-compatible text inference. Never forwards the cloud key.
const ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const MAX_BYTES=2*1024*1024;
function invalid(field:string):never{throw new Error('INVALID_LOCAL_PROVIDER:'+field);}
function object(value:unknown):Record<string,unknown>|null{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;}
function origin(value:unknown):string{
  if(typeof value!=='string')return invalid('baseUrl');
  let url:URL;try{url=new URL(value);}catch{return invalid('baseUrl');}
  if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||!['/','/v1','/v1/'].includes(url.pathname))return invalid('baseUrl');
  return url.origin+'/v1';
}
function payload(value:unknown){
  const p=object(value);
  if(!p||Object.keys(p).some(key=>!['model','messages','stream','temperature','top_p','max_tokens'].includes(key)))return invalid('payload.field');
  if(typeof p.model!=='string'||!ID.test(p.model)||p.model.split('/').some(x=>x==='.'||x==='..'||!x))return invalid('model');
  if(p.stream!==undefined&&p.stream!==false)return invalid('stream');
  if(!Array.isArray(p.messages)||p.messages.length<1||p.messages.length>100)return invalid('messages');
  let total=0;
  const messages=p.messages.map(raw=>{
    const m=object(raw);
    if(!m||!['system','user','assistant'].includes(String(m.role))||typeof m.content!=='string'||!m.content||m.content.length>50000)return invalid('messages.content');
    total+=m.content.length;
    return {role:m.role,content:m.content};
  });
  if(total>400000)return invalid('messages.size');
  const body:Record<string,unknown>={model:p.model,messages,stream:false};
  for(const [key,min,max] of [['temperature',0,2],['top_p',0,1],['max_tokens',1,8192]] as const){
    const n=p[key];if(n===undefined)continue;
    if(typeof n!=='number'||!Number.isFinite(n)||(key==='max_tokens'&&!Number.isInteger(n)))return invalid(key);
    body[key]=Math.max(min,Math.min(max,n));
  }
  return body;
}
async function boundedJson(response:Response){
  if(!response.body)throw Error('INVALID_LOCAL_PROVIDER_RESPONSE');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let text='',bytes=0;
  try{
    while(true){
      const result=await reader.read();if(result.done)break;
      bytes+=result.value.byteLength;
      if(bytes>MAX_BYTES){await reader.cancel();throw Error('INVALID_LOCAL_PROVIDER_RESPONSE');}
      text+=decoder.decode(result.value,{stream:true});
    }
    text+=decoder.decode();
  }finally{reader.releaseLock();}
  try{const value=object(JSON.parse(text));if(value)return value;}catch{}
  throw Error('INVALID_LOCAL_PROVIDER_RESPONSE');
}
export function createLocalNimProvider({baseUrl='http://127.0.0.1:8000/v1',fetchImpl=globalThis.fetch}:{baseUrl?:unknown;fetchImpl?:typeof fetch}={}){
  const base=origin(baseUrl);
  async function send(path:string,body:Record<string,unknown>|undefined,signal?:AbortSignal){
    const timeout=AbortSignal.timeout(body?120000:8000);
    const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
    let response:Response;
    try{
      response=await fetchImpl(base+path,{method:body?'POST':'GET',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:requestSignal,redirect:'error',cache:'no-store'});
    }catch(e){if(signal?.aborted)throw e;throw Error('LOCAL_PROVIDER_UNAVAILABLE');}
    if(!response.ok){await response.body?.cancel().catch(()=>{});throw Error(response.status===429?'LOCAL_PROVIDER_BUSY':'LOCAL_PROVIDER_ERROR');}
    return boundedJson(response);
  }
  async function models(signal?:AbortSignal):Promise<readonly string[]>{
    // A model list alone is not evidence of readiness or inference.
    const ready=await send('/health/ready',undefined,signal);
    if(ready.status!=='ready')throw Error('LOCAL_PROVIDER_UNAVAILABLE');
    const result=await send('/models',undefined,signal);
    if(!Array.isArray(result.data))throw Error('INVALID_LOCAL_PROVIDER_RESPONSE');
    return Object.freeze([...new Set(result.data.flatMap(raw=>{const id=object(raw)?.id;return typeof id==='string'&&ID.test(id)?[id]:[];}))].slice(0,200));
  }
  async function complete(value:unknown,signal?:AbortSignal){
    const body=payload(value);
    const data=await send('/chat/completions',body,signal);
    const choice=Array.isArray(data.choices)?object(data.choices[0]):null;
    const message=object(choice?.message);
    if(!message||message.role!=='assistant'||typeof message.content!=='string'||!message.content.trim())throw Error('INVALID_LOCAL_PROVIDER_RESPONSE');
    return {id:typeof data.id==='string'?data.id:'nim-local',object:'chat.completion',model:typeof data.model==='string'?data.model:body.model,choices:[{index:0,message:{role:'assistant',content:message.content},finish_reason:typeof choice?.finish_reason==='string'?choice.finish_reason:'stop'}]};
  }
  return Object.freeze({kind:'local' as const,baseUrl:base,models,complete});
}
