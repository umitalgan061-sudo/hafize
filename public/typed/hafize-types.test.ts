import { describe, expect, it } from 'vitest';
import {
  HafizeApiError,
  connectivityFromHealth,
  parseAgents,
  parseHealth,
  parseModels
} from './hafize-types.ts';

describe('typed Hafize contracts', () => {
  it('normalizes public agents without trusting malformed fields', () => {
    const parsed = parseAgents({
      defaultAgent: 'assistant',
      agents: [
        { id: 'assistant', name: 'Hafize', description: 'main', tools: ['github', 4, null] },
        { id: 4, name: 'invalid' },
        null,
        'invalid'
      ]
    });
    expect(parsed.defaultAgent).toBe('assistant');
    expect(parsed.agents).toEqual([{ id: 'assistant', name: 'Hafize', description: 'main', tools: ['github'] }]);
  });

  it('caps model payloads and keeps only strings', () => {
    const models = Array.from({ length: 230 }, (_, index) => index === 4 ? 42 : `model-${index}`);
    const parsed = parseModels({ models });
    expect(parsed.models).toHaveLength(200);
    expect(parsed.models).not.toContain(42);
    expect(parsed.models[0]).toBe('model-0');
  });

  it('maps an unhealthy or missing health payload to safe defaults', () => {
    const parsed = parseHealth({
      status: 500,
      nvidiaConfigured: 'yes',
      scheduleStorageDurable: true,
      agents: -3
    });
    expect(parsed.status).toBe('unknown');
    expect(parsed.nvidiaConfigured).toBe(false);
    expect(parsed.scheduleStorageDurable).toBe(true);
    expect(parsed.agents).toBe(0);
    expect(connectivityFromHealth(parsed, true)).toBe('degraded');
  });

  it('prefers local network state before server health', () => {
    const health = parseHealth({ status: 'ok', nvidiaConfigured: true });
    expect(connectivityFromHealth(health, false)).toBe('offline');
    expect(connectivityFromHealth(null, true)).toBe('unknown');
    expect(connectivityFromHealth(health, true)).toBe('online');
  });

  it('marks transport and upstream failures with explicit metadata', () => {
    const error = new HafizeApiError('rate limited', {
      code: 'RATE_LIMITED',
      status: 429,
      traceId: 'trace-123',
      retryable: true
    });
    expect(error.name).toBe('HafizeApiError');
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.status).toBe(429);
    expect(error.traceId).toBe('trace-123');
    expect(error.retryable).toBe(true);
  });
});
