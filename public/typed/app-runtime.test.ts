import { describe, expect, it } from 'vitest';
import { connectivityFromHealth, parseHealth } from './hafize-types.ts';

describe('runtime health model', () => {
  it('marks the browser offline before considering backend state', () => {
    const health = parseHealth({ status: 'ok', nvidiaConfigured: true, agents: 3 });
    expect(connectivityFromHealth(health, false)).toBe('offline');
  });

  it('reports a degraded state when API is reachable but NVIDIA is unavailable', () => {
    const health = parseHealth({ status: 'ok', nvidiaConfigured: false, agents: 2 });
    expect(connectivityFromHealth(health, true)).toBe('degraded');
  });

  it('does not expose arbitrary health response keys through normalization', () => {
    const health = parseHealth({
      status: 'ok',
      nvidiaConfigured: true,
      token: 'secret-should-not-leak',
      apiKey: 'private'
    });
    expect(Object.keys(health)).not.toContain('token');
    expect(Object.keys(health)).not.toContain('apiKey');
  });
});
