import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig, RUNTIME_CONFIG_LIMITS } from './runtime-config.ts';

describe('runtime config',()=>{
  it('derives safe development defaults',()=>{
    const config=parseRuntimeConfig({HOST:'127.0.0.1',NODE_ENV:'development'});
    expect(config.authRequired).toBe(false);
    expect(config.host).toBe('127.0.0.1');
    expect(config.localModelEnabled).toBe(false);
  });
  it('requires a strong token for public runtime',()=>{
    expect(()=>parseRuntimeConfig({HOST:'0.0.0.0',NODE_ENV:'production'})).toThrow('HAFIZE_AUTH_TOKEN_REQUIRED_FOR_PUBLIC_RUNTIME');
  });
  it('bounds and validates secret configuration',()=>{
    expect(()=>parseRuntimeConfig({HOST:'0.0.0.0',HAFIZE_AUTH_TOKEN:'short'})).toThrow('TOKEN_TOO_SHORT');
    expect(()=>parseRuntimeConfig({HOST:'0.0.0.0',HAFIZE_AUTH_TOKEN:'x'.repeat(32),HAFIZE_AUTH_REQUIRED:'true',HAFIZE_LOCAL_MODEL_BASE_URL:'https://example.com'})).toThrow('LOCAL_MODEL_URL');
  });
  it('accepts a complete local-model config',()=>{
    const config=parseRuntimeConfig({HOST:'127.0.0.1',HAFIZE_AUTH_TOKEN:'x'.repeat(32),HAFIZE_AUTH_REQUIRED:'false',HAFIZE_LOCAL_MODEL_ENABLED:'true',HAFIZE_LOCAL_MODEL_BASE_URL:'http://127.0.0.1:11434/'});
    expect(config.localModelEnabled).toBe(true);
    expect(config.localModelBaseUrl).toBe('http://127.0.0.1:11434');
    expect(RUNTIME_CONFIG_LIMITS.minTokenLength).toBe(32);
  });
});
