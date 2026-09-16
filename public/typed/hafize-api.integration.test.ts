import { describe, expect, it, vi } from 'vitest';
import { HafizeApiClient } from './hafize-api.ts';

describe('typed API integration semantics', () => {
  it('keeps request paths relative to the configured base URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      expect(String(input)).toBe('/hafize/api/health');
      return new Response(JSON.stringify({ status: 'ok', nvidiaConfigured: true }));
    });
    const api = new HafizeApiClient('/hafize', fetchImpl);
    await api.health();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('accepts absolute backend bases without duplicating slashes', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      expect(String(input)).toBe('https://example.test/api/models');
      return new Response(JSON.stringify({ models: ['a'] }));
    });
    const api = new HafizeApiClient('https://example.test/', fetchImpl);
    expect((await api.models()).models).toEqual(['a']);
  });
});
