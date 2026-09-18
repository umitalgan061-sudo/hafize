import { describe, expect, it } from 'vitest';
import { createBearerPrincipalAuthenticator, SERVER_AUTH_LIMITS } from './server-auth.ts';

const token='x'.repeat(32);

describe('server auth',()=>{
  it('accepts a valid bearer token',()=>{
    const auth=createBearerPrincipalAuthenticator({token,subject:'test-user'});
    const result=auth.authenticate({headers:{authorization:'Bearer '+token}});
    expect(result.ok).toBe(true);
    if(result.ok) expect(result.principal.subject).toBe('test-user');
  });
  it('rejects malformed and invalid authorization',()=>{
    const auth=createBearerPrincipalAuthenticator({token,subject:'test-user'});
    expect(auth.authenticate({headers:{}}).ok).toBe(false);
    expect(auth.authenticate({headers:{authorization:'Basic '+token}}).ok).toBe(false);
    expect(auth.authenticate({headers:{authorization:'Bearer '+'y'.repeat(32)}}).ok).toBe(false);
  });
  it('enforces construction limits',()=>{
    expect(()=>createBearerPrincipalAuthenticator({token:'short',subject:'test-user'})).toThrow('INVALID_SERVER_AUTH:token');
    expect(()=>createBearerPrincipalAuthenticator({token,subject:''})).toThrow('INVALID_SERVER_AUTH:subject');
    expect(SERVER_AUTH_LIMITS.minTokenLength).toBe(32);
  });
  it('does not mutate supplied headers',()=>{
    const headers={authorization:'Bearer '+token};
    createBearerPrincipalAuthenticator({token,subject:'test-user'}).authenticate({headers});
    expect(headers.authorization).toBe('Bearer '+token);
  });
});
