import { describe, expect, it, vi } from 'vitest';
import { HafizeApiClient, HafizeApiError } from './hafize-api.ts';

type FetchSequence = Array<Response | Error>;

function fetchMock(sequence: FetchSequence): typeof fetch {
  let index = 0;
  return vi.fn(async () => {
    const value = sequence[Math.min(index++, sequence.length - 1)];
    if (value instanceof Error) throw value;
    return value;
  }) as unknown as typeof fetch;
}

describe('HafizeApiClient', () => {
  it('normalizes successful health, model and agent responses', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/health')) return new Response(JSON.stringify({ status: 'ok', nvidiaConfigured: true, agents: 2 }));
      if (url.endsWith('/api/models')) return new Response(JSON.stringify({ models: ['a', 'b'] }));
      return new Response(JSON.stringify({ defaultAgent: 'a', agents: [{ id: 'a', name: 'A' }] }));
    });
    const api = new HafizeApiClient('/app', fetchImpl);
    expect((await api.health()).nvidiaConfigured).toBe(true);
    expect((await api.models()).models).toEqual(['a', 'b']);
    expect((await api.agents()).defaultAgent).toBe('a');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('retries transient HTTP failures and returns the following successful payload', async () => {
    vi.useFakeTimers();
    const fetchImpl = fetchMock([
      new Response(JSON.stringify({ error: 'TEMPORARY' }), { status: 503, headers: { 'X-Hafize-Trace-Id': 'trace-a' } }),
      new Response(JSON.stringify({ status: 'ok', nvidiaConfigured: true }))
    ]);
    const api = new HafizeApiClient('', fetchImpl);
    const promise = api.health();
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.nvidiaConfigured).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not retry non-transient client errors', async () => {
    const fetchImpl = fetchMock([new Response(JSON.stringify({ error: 'INVALID_CHAT_REQUEST' }), { status: 400 })]);
    const api = new HafizeApiClient('', fetchImpl);
    await expect(api.health()).rejects.toMatchObject({
      name: 'HafizeApiError',
      code: 'INVALID_CHAT_REQUEST',
      status: 400,
      retryable: false
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retains trace ids from upstream failure headers', async () => {
    const fetchImpl = fetchMock([
      new Response(JSON.stringify({ error: 'UPSTREAM' }), {
        status: 502,
        headers: { 'X-Hafize-Trace-Id': 'trace-xyz' }
      })
    ]);
    const api = new HafizeApiClient('', fetchImpl);
    await expect(api.models()).rejects.toBeInstanceOf(HafizeApiError);
    try {
      await api.models();
    } catch (error) {
      expect(error).toMatchObject({ code: 'UPSTREAM', status: 502, traceId: 'trace-xyz', retryable: true });
    }
  });

  it('maps transport errors to a retryable NETWORK_ERROR', async () => {
    vi.useFakeTimers();
    const fetchImpl = fetchMock([new Error('socket closed'), new Error('socket closed')]);
    const api = new HafizeApiClient('', fetchImpl);
    const promise = api.models();
    const assertion = expect(promise).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not time out model/agent requests while the user enters the access key', async () => {
    vi.useFakeTimers();
    const globalWithAuth = globalThis as typeof globalThis & {
      HafizeAuth?: { fetch?: typeof fetch; ensureAuthenticated?: () => Promise<void> }
    };
    const previous = globalWithAuth.HafizeAuth;
    let finishLogin: (() => void) | undefined;
    const login = new Promise<void>((resolve) => { finishLogin = resolve; });
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      return String(input).includes('/api/models')
        ? new Response(JSON.stringify({ models: ['nvidia-model'] }))
        : new Response(JSON.stringify({ defaultAgent: 'main', agents: [{ id: 'main', name: 'Hafize' }] }));
    });
    globalWithAuth.HafizeAuth = { fetch: fetchImpl, ensureAuthenticated: () => login };
    try {
      const api = new HafizeApiClient('', fetchImpl);
      const models = api.models();
      const agents = api.agents();
      // Longer than BOTH normal 8s/12s request timeouts, but no HTTP request
      // has begun while the login form is open.
      await vi.advanceTimersByTimeAsync(20_000);
      expect(fetchImpl).not.toHaveBeenCalled();
      finishLogin?.();
      expect((await models).models).toEqual(['nvidia-model']);
      expect((await agents).defaultAgent).toBe('main');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      globalWithAuth.HafizeAuth = previous;
      vi.useRealTimers();
    }
  });

  it('stops an API request if protected session validation is unavailable', async () => {
    const globalWithAuth = globalThis as typeof globalThis & {
      HafizeAuth?: { fetch?: typeof fetch; ensureAuthenticated?: () => Promise<void> }
    };
    const previous = globalWithAuth.HafizeAuth;
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ models: [] })));
    globalWithAuth.HafizeAuth = {
      fetch: fetchImpl,
      ensureAuthenticated: async () => { throw new Error('AUTH_SESSION_FAILED'); }
    };
    try {
      await expect(new HafizeApiClient('', fetchImpl).models()).rejects.toMatchObject({
        code: 'AUTH_SESSION_FAILED', retryable: false
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      globalWithAuth.HafizeAuth = previous;
    }
  });

  it('honors caller abort signals without turning the request into an infinite retry loop', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.signal?.aborted).toBe(false);
      controller.abort(new DOMException('test abort', 'AbortError'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      throw init?.signal?.reason ?? new DOMException('aborted', 'AbortError');
    });
    const api = new HafizeApiClient('', fetchImpl);
    await expect(api.request('/api/health', { signal: controller.signal, retry: 0 })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
