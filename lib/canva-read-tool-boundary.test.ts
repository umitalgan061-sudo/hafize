import { describe, expect, it } from 'vitest';
import { CANVA_READ_TOOL_DEFINITION, CanvaReadToolError, createCanvaReadToolBoundary } from './canva-read-tool-boundary.ts';

describe('typed Canva read boundary', () => {
  it('requires a client and owner resolver', () => {
    expect(() => createCanvaReadToolBoundary({
      readClient: { read: async () => ({}) },
      ownerResolver: { resolve: () => ({ ownerId: 'owner-1' }) }
    })).not.toThrow();
  });

  it('resolves ownership server-side', async () => {
    let received: unknown;
    const boundary = createCanvaReadToolBoundary({
      readClient: { read: async (input) => { received = input; return { ok: true }; } },
      ownerResolver: { resolve: () => ({ ownerId: 'owner-1' }) }
    });
    await boundary.execute({
      operation: 'design.list',
      params: { query: 'ankara', limit: 10 }
    }, { principal: { subject: 'primary-user' } });
    expect(received).toEqual({
      ownerId: 'owner-1',
      operation: 'design.list',
      params: { query: 'ankara', limit: 10 }
    });
  });

  it('rejects unknown fields and invalid owners', async () => {
    const boundary = createCanvaReadToolBoundary({
      readClient: { read: async () => ({}) },
      ownerResolver: { resolve: () => ({ ownerId: '' }) }
    });
    await expect(boundary.execute({ operation: 'design.get', nope: true })).rejects.toBeInstanceOf(CanvaReadToolError);
    await expect(boundary.execute({ operation: 'design.get' })).rejects.toMatchObject({ code: 'INVALID_CANVA_READ_TOOL' });
  });

  it('publishes a closed tool schema', () => {
    expect(CANVA_READ_TOOL_DEFINITION.function.name).toBe('canva_read');
    expect(CANVA_READ_TOOL_DEFINITION.function.parameters.additionalProperties).toBe(false);
    expect(CANVA_READ_TOOL_DEFINITION.function.parameters.properties.operation.enum).toContain('design.get');
  });
});
