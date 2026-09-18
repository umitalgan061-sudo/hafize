import { describe, expect, it } from 'vitest';
import { API_ERROR_CONTRACT, isRetryableApiError, mapToolFailureToApiError, normalizeApiError } from './api-error-contract.ts';

describe('api error contract',()=>{
  it('normalizes unsafe status and text',()=>{
    const error=normalizeApiError({code:'UNKNOWN',status:700,message:'a\n\tb',requestId:'  trace-1  '});
    expect(error.error).toBe('INTERNAL_ERROR');
    expect(error.status).toBe(500);
    expect(error.message).toBe('a b');
    expect(error.requestId).toBe('trace-1');
  });
  it('classifies retryable statuses',()=>{
    expect(isRetryableApiError({code:'RATE_LIMITED',status:429})).toBe(true);
    expect(isRetryableApiError({code:'AUTH_REQUIRED',status:401})).toBe(false);
    expect(isRetryableApiError({code:'INTERNAL_ERROR',status:503})).toBe(true);
  });
  it('maps tool failures safely',()=>{
    expect(mapToolFailureToApiError({error:'TOOL_NOT_AUTHORIZED'},'trace').status).toBe(403);
    expect(mapToolFailureToApiError({},'trace').error).toBe('INTERNAL_ERROR');
  });
  it('keeps limits explicit',()=>{
    expect(API_ERROR_CONTRACT.maxMessageLength).toBe(500);
    expect(API_ERROR_CONTRACT.maxRequestIdLength).toBe(120);
  });
});
