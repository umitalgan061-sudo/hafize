import { describe, expect, it } from 'vitest';
import { createCanvaAgentRuntime } from './canva-agent-runtime.ts';
import { createGmailAgentRuntime } from './gmail-agent-runtime.ts';

const emptyEnv = {};

describe('typed connector runtimes', () => {
  it('stay disabled when connector configuration is absent', async () => {
    const canva = createCanvaAgentRuntime({ env: emptyEnv, fetchImpl: async () => new Response('{}') });
    const gmail = createGmailAgentRuntime({ env: emptyEnv, fetchImpl: async () => new Response('{}') });
    expect(canva.configured).toBe(false);
    expect(gmail.configured).toBe(false);
    await expect(canva.connectionStatus()).resolves.toMatchObject({ ok: false, error: 'CANVA_NOT_CONFIGURED' });
    await expect(gmail.connectionStatus()).resolves.toMatchObject({ ok: false, error: 'GMAIL_NOT_CONFIGURED' });
  });

  it('rejects partial connector credentials before constructing dependencies', () => {
    const env = {
      HAFIZE_CONNECTOR_AUTH_TOKEN: 'token',
      HAFIZE_CONNECTOR_AUTH_SUBJECT: 'subject'
    };
    expect(() => createCanvaAgentRuntime({ env, fetchImpl: async () => new Response('{}') })).toThrow(/INVALID_CANVA_AGENT_RUNTIME:config/);
    expect(() => createGmailAgentRuntime({ env, fetchImpl: async () => new Response('{}') })).toThrow(/INVALID_GMAIL_AGENT_RUNTIME:config/);
  });
});
