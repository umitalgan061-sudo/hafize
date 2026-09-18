import { describe, expect, it } from 'vitest';
import { createSessionAuth } from './session-auth.ts';

const secret='s'.repeat(40);

describe('session auth',()=>{
  it('issues and verifies a signed session',()=>{
    const auth=createSessionAuth({secret,subject:'u',ttlSeconds:300});
    const value=auth.issueSession();
    const verified=auth.verifySessionCookie(value);
    expect(verified.ok).toBe(true);
    if(verified.ok){
      expect(verified.principal.subject).toBe('u');
      expect(verified.csrf.length).toBeGreaterThan(20);
    }
  });
  it('rejects tampered sessions',()=>{
    const auth=createSessionAuth({secret,subject:'u',ttlSeconds:300});
    const value=auth.issueSession();
    expect(auth.verifySessionCookie(value+'.tamper').ok).toBe(false);
  });
  it('round-trips through cookie headers',()=>{
    const auth=createSessionAuth({secret,subject:'u',ttlSeconds:300});
    const value=auth.issueSession();
    const cookie=auth.sessionCookieHeader(value).split(';')[0]!;
    const result=auth.authenticate({cookie});
    expect(result.ok).toBe(true);
    expect(auth.clearCookieHeader()).toContain('Max-Age=0');
  });
});
