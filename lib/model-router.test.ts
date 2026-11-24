import { describe, expect, it } from 'vitest';
import { createModelRouter, DEFAULT_MODEL_CHAIN, failureReason, parseModelChain } from './model-router.ts';

const chain = ['top', 'middle', 'bottom'];
const request = (extra: Record<string, unknown> = {}) => JSON.stringify({ model: 'anything', stream: true, messages: [{ role: 'user', content: 'x' }], ...extra });
// Like a real fetch response: headers are immutable, and touching them must not read as a model failure.
const answer = (status: number, headers: Record<string, string> = {}) => { const response = new Response(status === 200 ? '{}' : 'hata', { status, headers }); Object.defineProperty(response.headers, 'set', { value() { throw new TypeError('immutable'); } }); return response; };

function setup(script: Record<string, () => Response | Promise<Response>>, keepFirst: string[] = []) {
  const clock = { now: 1_000_000 };
  const calls: string[] = [];
  const logs: string[] = [];
  const router = createModelRouter({ chain, keepFirst, now: () => clock.now, log: (line) => logs.push(line) });
  const deliver = async (body: string) => {
    const model = JSON.parse(body).model as string;
    calls.push(model);
    return (script[model] ?? (() => answer(200)))();
  };
  return { clock, calls, logs, router, deliver };
}

describe('model router', () => {
  it('uses the top model whatever the client asked for', async () => {
    const { router, deliver, calls } = setup({});
    const response = await router.send(request(), deliver);
    expect(response.ok).toBe(true);
    expect(calls).toEqual(['top']);
    expect(router.status().current).toBe('top');
  });

  it.each([[402, 'kota'], [403, 'kota'], [429, 'sınır'], [404, 'yok'], [410, 'kalktı'], [500, 'hata'], [503, 'hata'], [408, 'zaman']])('falls one step on %i (%s)', async (status) => {
    const { router, deliver, calls } = setup({ top: () => answer(status) });
    expect((await router.send(request(), deliver)).ok).toBe(true);
    expect(calls).toEqual(['top', 'middle']);
  });

  it('falls on a network failure', async () => {
    const { router, deliver, calls } = setup({ top: () => { throw new TypeError('fetch failed'); } });
    expect((await router.send(request(), deliver)).ok).toBe(true);
    expect(calls).toEqual(['top', 'middle']);
  });

  it('walks down as far as it has to', async () => {
    const { router, deliver, calls } = setup({ top: () => answer(429), middle: () => answer(402) });
    expect((await router.send(request(), deliver)).ok).toBe(true);
    expect(calls).toEqual(['top', 'middle', 'bottom']);
  });

  it('does not keep knocking on a model that is out, and returns to the top when it recovers', async () => {
    let topWorks = false;
    const { router, deliver, calls, clock } = setup({ top: () => (topWorks ? answer(200) : answer(429)) });
    await router.send(request(), deliver);
    calls.length = 0;
    await router.send(request(), deliver);
    expect(calls).toEqual(['middle']);
    expect(router.status().current).toBe('middle');
    topWorks = true;
    clock.now += 61_000;
    calls.length = 0;
    await router.send(request(), deliver);
    expect(calls).toEqual(['top']);
    expect(router.status().current).toBe('top');
  });

  it('honours Retry-After', async () => {
    const { router, deliver, calls, clock } = setup({ top: () => answer(429, { 'retry-after': '300' }) });
    await router.send(request(), deliver);
    clock.now += 200_000;
    calls.length = 0;
    await router.send(request(), deliver);
    expect(calls).toEqual(['middle']);
    expect(router.status().chain[0]).toMatchObject({ ready: false, lastFailure: 'rate', retryInSeconds: 100 });
  });

  it('keeps a quota-exhausted model out for an hour', async () => {
    const { router, deliver, calls, clock } = setup({ top: () => answer(402) });
    await router.send(request(), deliver);
    clock.now += 59 * 60_000;
    calls.length = 0;
    await router.send(request(), deliver);
    expect(calls).toEqual(['middle']);
  });

  it('still tries everything when the whole chain is cooling down', async () => {
    const { router, deliver, calls } = setup({ top: () => answer(429), middle: () => answer(429), bottom: () => answer(429) });
    expect((await router.send(request(), deliver)).status).toBe(429);
    calls.length = 0;
    await router.send(request(), deliver);
    expect(calls).toEqual(['top', 'middle', 'bottom']);
  });

  it('returns the last response unread so the caller can report it', async () => {
    const { router, deliver } = setup({ top: () => answer(500), middle: () => answer(500), bottom: () => new Response('son hata', { status: 503 }) });
    const response = await router.send(request(), deliver);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('son hata');
  });

  it('does not fall for a rejected key or a malformed request', async () => {
    for (const status of [401, 400, 422]) {
      const { router, deliver, calls } = setup({ top: () => answer(status) });
      expect((await router.send(request(), deliver)).status).toBe(status);
      expect(calls).toEqual(['top']);
    }
  });

  it('a user stopping the answer is not held against the model', async () => {
    const controller = new AbortController();
    const { router, calls } = setup({});
    const deliver = async (body: string) => { calls.push(JSON.parse(body).model); controller.abort(); throw new DOMException('aborted', 'AbortError'); };
    await expect(router.send(request(), deliver, controller.signal)).rejects.toThrow();
    expect(calls).toEqual(['top']);
    expect(router.status().chain[0]).toMatchObject({ ready: true, lastFailure: null });
  });

  it('gives up on a silent model and moves on', async () => {
    const realSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: () => void, _ms: number) => realSetTimeout(fn, 5)) as typeof setTimeout;
    try {
      const { router, calls } = setup({});
      const deliver = (body: string, signal: AbortSignal) => {
        const model = JSON.parse(body).model as string;
        calls.push(model);
        if (model !== 'top') return Promise.resolve(answer(200));
        return new Promise<Response>((_resolve, reject) => { signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))); });
      };
      expect((await router.send(request(), deliver)).ok).toBe(true);
      expect(calls).toEqual(['top', 'middle']);
      expect(router.status().chain[0]?.lastFailure).toBe('slow');
    } finally { globalThis.setTimeout = realSetTimeout; }
  });

  it('runs internal fast jobs on their own model first, then falls back', async () => {
    const { router, deliver, calls } = setup({ middle: () => answer(429) }, ['middle']);
    await router.send(request({ model: 'middle' }), deliver);
    expect(calls).toEqual(['middle', 'top']);
  });

  it('leaves single-purpose models and image requests alone', () => {
    const { router } = setup({});
    expect(router.shouldRoute({ model: 'x/content-safety' })).toBe(false);
    expect(router.shouldRoute({ model: 'nvidia/nemotron-3.5-super-vl-120b-a12b' })).toBe(false);
    expect(router.shouldRoute({ model: 'any', messages: [{ content: [{ type: 'image_url' }] }] })).toBe(false);
    expect(router.shouldRoute({ model: 'any', messages: [{ content: 'yazı' }] })).toBe(true);
  });

  it('only sends the thinking switch to the model that understands it', async () => {
    const seen: Record<string, unknown>[] = [];
    const router = createModelRouter({ chain: ['a', 'x-lightning'], log: () => {} });
    await router.send(JSON.stringify({ model: 'a', chat_template_kwargs: { enable_thinking: false } }), async (body) => { seen.push(JSON.parse(body)); return answer(seen.length === 1 ? 500 : 200); });
    expect(seen[0]?.chat_template_kwargs).toBeUndefined();
    expect(seen[1]?.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it('reads its chain from the environment', () => {
    expect(parseModelChain('')).toBe(DEFAULT_MODEL_CHAIN);
    expect(parseModelChain(' a, b ,a,')).toEqual(['a', 'b']);
    expect(failureReason(200)).toBeNull();
  });
});

it('keeps the response stream cancellable after headers arrive', async () => {
  const {router} = setup({});
  const controller = new AbortController();
  let captured: AbortSignal | undefined;
  await router.send(request(), async (_body, signal) => { captured = signal; return answer(200); }, controller.signal);
  controller.abort();
  expect(captured?.aborted).toBe(true);
});
it('respects a retry deadline sent as an HTTP date', async () => {
  const {router,deliver} = setup({top:()=>answer(429,{'retry-after':new Date(1_300_000).toUTCString()})});
  await router.send(request(),deliver);
  expect(router.status().chain[0]?.retryInSeconds).toBe(300);
});

it('uses measured compatible models without expanding the configured chain', async () => {
  const calls: string[] = [];
  const router = createModelRouter({ chain, preferredModels: () => ['external/model', 'middle'], log: () => {} });
  await router.send(request(), async body => { const model=JSON.parse(body).model; calls.push(model); return answer(model==='middle'?503:200); });
  expect(calls).toEqual(['middle','top']);
});


it('uses configured extra candidates only after measured preference, never arbitrary model IDs',async()=>{
  const attempts:string[]=[];
  let measured:readonly string[]=[];
  const router=createModelRouter({chain:['base'],extraCandidates:['verified-extra'],preferredModels:()=>measured,log:()=>{}});
  const deliver=async(body:string)=>{attempts.push(JSON.parse(body).model);return answer(200);};
  await router.send(request(),deliver);
  expect(attempts).toEqual(['base']);
  measured=['unknown','verified-extra'];
  await router.send(request(),deliver);
  expect(attempts).toEqual(['base','verified-extra']);
  measured=[];
  await router.send(request(),deliver);
  expect(attempts).toEqual(['base','verified-extra','base']);
});

it('does not swap specialized or non-text inputs into general chat models',()=>{
  const router=createModelRouter({chain:['base'],extraCandidates:['extra']});
  for(const model of ['nvidia/test-vl','nvidia/nemotron-ocr','nvidia/parakeet','nvidia/test-rerank']) expect(router.shouldRoute({model})).toBe(false);
  for(const type of ['input_audio','video_url','file']) expect(router.shouldRoute({model:'base',messages:[{content:[{type}]}]})).toBe(false);
  expect(router.status().extraCandidates).toEqual([{model:'extra',ready:true,lastFailure:null,retryInSeconds:0}]);
});
