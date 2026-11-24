import type {AuthHeaders} from './server-auth.ts';
import type {AuthenticationResult} from './runtime-contracts.ts';
/** Trust only the non-enumerable server-side principal attached by the production guard. */
export function createScheduleSessionAuthenticator(legacy:{authenticate(input:{headers?:AuthHeaders}):AuthenticationResult}|null){
 return Object.freeze({authenticate({request,headers}:{request?:unknown;headers?:AuthHeaders}={}):AuthenticationResult{
  if(request&&typeof request==='object'){
   const descriptor=Object.getOwnPropertyDescriptor(request,'__hafizePrincipal');
   const principal=descriptor?.value;
   if(descriptor?.enumerable===false&&descriptor.configurable===false&&principal&&typeof principal.ownerId==='string'&&principal.ownerId.length>0&&principal.ownerId.length<=200&&!principal.ownerId.startsWith('connector:')&&typeof principal.sessionId==='string'&&/^[a-f0-9]{64}$/.test(principal.sessionId)){
    return {ok:true,principal:{authenticated:true,subject:principal.ownerId}};
   }
  }
  return legacy?.authenticate({headers})??{ok:false,error:'AUTH_REQUIRED'};
 }});
}
