import {it,expect} from 'vitest';
import {createScheduleSessionAuthenticator} from './schedule-session-auth.ts';
import {createBearerPrincipalAuthenticator} from './server-auth.ts';
it('accepts only server-attached owner identity and preserves explicitly configured bearer scope',()=>{
 const legacy=createBearerPrincipalAuthenticator({token:'a'.repeat(32),subject:'legacy-owner'});
 const auth=createScheduleSessionAuthenticator(legacy);
 const req={};Object.defineProperty(req,'__hafizePrincipal',{value:Object.freeze({ownerId:'owner',sessionId:'b'.repeat(64)}),enumerable:false,configurable:false});
 expect(auth.authenticate({request:req})).toMatchObject({ok:true,principal:{subject:'owner'}});
 expect(auth.authenticate({headers:{'x-hafize-owner':'owner'}})).toMatchObject({ok:false});
 expect(auth.authenticate({request:{__hafizePrincipal:{ownerId:'owner',sessionId:'b'.repeat(64)}}})).toMatchObject({ok:false});
 expect(auth.authenticate({headers:{authorization:'Bearer '+'a'.repeat(32)}})).toMatchObject({ok:true,principal:{subject:'legacy-owner'}});
 expect(createScheduleSessionAuthenticator(null).authenticate()).toMatchObject({ok:false});
});
