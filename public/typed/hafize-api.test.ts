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
    // Attach the rejection handler before advancing timers: the retry budget is
    // exhausted inside runAllTimersAsync, and an unobserved rejection there is
    // reported as an unhandled error even though the assertion later passes.
    const rejection = expect(promise).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    await vi.runAllTimersAsync();
    await rejection;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
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
