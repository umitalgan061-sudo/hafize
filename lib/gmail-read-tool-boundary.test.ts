import { describe, expect, it } from 'vitest';
import { GMAIL_READ_TOOL_DEFINITION, GmailReadToolError, createGmailReadToolBoundary } from './gmail-read-tool-boundary.ts';

describe('typed Gmail read boundary', () => {
  it('binds reads to the resolved owner', async () => {
    let received: unknown;
    const boundary = createGmailReadToolBoundary({
      readClient: { read: async (input) => { received = input; return { ok: true }; } },
      ownerResolver: { resolve: () => ({ ownerId: 'owner-1' }) }
    });
    await boundary.execute({
      operation: 'message.list',
      params: { query: 'from:example@example.com', maxResults: 20 }
    }, { principal: { subject: 'primary-user' } });
    expect(received).toEqual({
      ownerId: 'owner-1',
      operation: 'message.list',
      params: { query: 'from:example@example.com', maxResults: 20 }
    });
  });

  it('blocks unknown fields and missing ownership', async () => {
    const boundary = createGmailReadToolBoundary({
      readClient: { read: async () => ({}) },
      ownerResolver: { resolve: () => null }
    });
    await expect(boundary.execute({ operation: 'profile.get', nope: true })).rejects.toBeInstanceOf(GmailReadToolError);
    await expect(boundary.execute({ operation: 'profile.get' })).rejects.toMatchObject({ code: 'INVALID_GMAIL_READ_TOOL' });
  });

  it('keeps the model-facing schema read-only', () => {
    expect(GMAIL_READ_TOOL_DEFINITION.function.name).toBe('gmail_read');
    expect(GMAIL_READ_TOOL_DEFINITION.function.parameters.additionalProperties).toBe(false);
    expect(GMAIL_READ_TOOL_DEFINITION.function.parameters.properties.operation.enum).toContain('message.get');
  });
});
