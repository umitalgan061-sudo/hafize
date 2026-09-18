import { describe, expect, it } from 'vitest';
import { createSecurityEventLogger, SECURITY_OBSERVABILITY_LIMITS } from './security-observability.ts';

describe('security observability',()=>{
  it('normalizes event data and strips secrets',()=>{
    const lines:string[]=[];
    const logger=createSecurityEventLogger({sink:(line)=>lines.push(line),now:()=>0});
    const event=logger.record({
      event:'auth.denied',
      route:'https://example.test/api/login?x=1',
      method:'post',
      outcome:'blocked',
      metadata:{username:'u',authorization:'secret',ok:true}
    });
    expect(event.route).toBe('/api/login');
    expect(event.method).toBe('POST');
    expect(event.metadata).toEqual({username:'u',ok:true});
    expect(lines[0]).toContain('hafize.security');
  });
  it('produces stable short principal fingerprints',()=>{
    const logger=createSecurityEventLogger({sink:()=>{}});
    const first=logger.classifyPrincipal('user-1');
    expect(first).toBe(logger.classifyPrincipal('user-1'));
    expect(first).not.toBe(logger.classifyPrincipal('user-2'));
    expect(first).toHaveLength(SECURITY_OBSERVABILITY_LIMITS.fingerprintLength);
  });
});
