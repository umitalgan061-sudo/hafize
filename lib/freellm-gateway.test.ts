import { describe, expect, it } from 'vitest';
import { freeLlmGateway } from './freellm-gateway.ts';

describe('FreeLLM gateway', () => {
  const env = { HAFIZE_FREELLM_BASE_URL: 'http://localhost:3001/v1/', HAFIZE_FREELLM_MODEL: 'auto', HAFIZE_FREELLM_API_KEY: 'fixture' };
  it('preserves the default provider without explicit settings', () => {
    expect(freeLlmGateway({ NVIDIA_API_KEY: 'fixture' })).toBeNull();
  });
  it('uses a fully configured gateway', () => {
    expect(freeLlmGateway(env)).toEqual({ baseUrl: 'http://localhost:3001/v1', model: 'auto', apiKey: 'fixture' });
  });
  it('requires a dedicated credential and secure remote transport', () => {
    expect(() => freeLlmGateway({ ...env, HAFIZE_FREELLM_API_KEY: '' })).toThrow();
    expect(() => freeLlmGateway({ ...env, HAFIZE_FREELLM_BASE_URL: 'http://example.org/v1' })).toThrow();
  });
});
