import { describe, expect, it } from 'vitest';
import { createScheduleHttpApi } from './schedule-http-api.ts';

const principal = { authenticated: true as const, subject: 'user-1' };
const commands = {
  async list(input: Record<string, unknown>) { return { ok: true, op: 'list', subject: (input.principal as typeof principal).subject }; },
  async create(input: Record<string, unknown>) { return { ok: true, op: 'create', input: input.input }; },
  async cancel(input: Record<string, unknown>) { return { ok: true, op: 'cancel', id: input.scheduleId }; }
};
const auth = {
  authenticate: ({ headers }: { headers?: unknown }) =>
    headers === 'ok'
      ? ({ ok: true, principal } as const)
      : ({ ok: false, error: 'AUTH_REQUIRED' } as const)
};
const readJson = async (_request: unknown) => ({ title: 'daily' });

describe('typed schedule HTTP API', () => {
  it('rejects unauthenticated reads without touching commands', async () => {
    const api = createScheduleHttpApi({ authenticator: auth, commands, readJson });
    await expect(api.handle({ method: 'GET', pathname: '/api/schedules', headers: 'no' })).resolves.toMatchObject({
      matched: true, status: 401, body: { error: 'AUTH_REQUIRED' }
    });
  });

  it('lists, creates and cancels authenticated schedules', async () => {
    const api = createScheduleHttpApi({ authenticator: auth, commands, readJson });
    await expect(api.handle({ method: 'GET', pathname: '/api/schedules', headers: 'ok' })).resolves.toMatchObject({ status: 200, body: { op: 'list' } });
    await expect(api.handle({ method: 'POST', pathname: '/api/schedules', headers: 'ok', request: {} })).resolves.toMatchObject({ status: 201, body: { op: 'create' } });
    await expect(api.handle({ method: 'DELETE', pathname: '/api/schedules/abc', headers: 'ok' })).resolves.toMatchObject({ status: 200, body: { op: 'cancel', id: 'abc' } });
  });

  it('returns 404 for malformed schedule paths and 405 for invalid methods', async () => {
    const api = createScheduleHttpApi({ authenticator: auth, commands, readJson });
    await expect(api.handle({ method: 'GET', pathname: '/api/schedules/%2F', headers: 'ok' })).resolves.toMatchObject({ status: 404 });
    await expect(api.handle({ method: 'PATCH', pathname: '/api/schedules', headers: 'ok' })).resolves.toMatchObject({ status: 405 });
  });
});
