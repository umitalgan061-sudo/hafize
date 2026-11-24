/** Bounded, synthetic NVIDIA probes. Never benchmark with conversation data or tools that have side effects. */
export type ProbeState = 'passed' | 'failed' | 'unavailable' | 'rate_limited' | 'quota' | 'timeout' | 'invalid_response';
export interface ProbeResult {
  readonly model: string;
  readonly testedAt: string;
  readonly status: ProbeState;
  readonly chat: boolean;
  readonly turkish: boolean;
  readonly reasoning: boolean;
  readonly coding: boolean;
  readonly tools: boolean;
  readonly latencyMs: number;
  readonly requests: number;
}
const MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/;
const MAX_REQUESTS = 12;
const WINDOW_MS = 10 * 60_000;
const EXPIRY_MS = 24 * 60 * 60_000;
const CATALOG_LIMIT = 500;
const TEST_MESSAGE = 'Yalnız JSON döndür: {"capital":"Türkiye başkenti", "math": 17*23-8 sonucu, "code": Python sum([2,4,6][::-1]) sonucu}. capital alanı Ankara veya doğru Türkçe şehir adı olmalı.';
const TEST_TOOL = { type: 'function', function: { name: 'benchmark_echo', description: 'Sadece sentetik test: verilen sayıyı döndürür.', parameters: { type: 'object', properties: { value: { type: 'integer' } }, required: ['value'], additionalProperties: false } } };
const statusFor = (status: number): ProbeState => status === 429 ? 'rate_limited' : status === 402 || status === 403 ? 'quota' : status === 404 || status === 410 ? 'unavailable' : 'failed';
function object(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function message(data: unknown) { const choices = object(data)?.choices; return Array.isArray(choices) ? object(object(choices[0])?.message) : null; }
function parseAnswer(value: unknown) { if (typeof value !== 'string') return null; try { return object(JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))); } catch { return null; } }
export function createModelLab({ allowed, request, now = Date.now }: {
  allowed: readonly string[];
  request: (path: '/models' | '/chat/completions', body: Record<string, unknown> | null, signal: AbortSignal) => Promise<Response>;
  now?: () => number;
}) {
  const eligible = [...new Set(allowed.filter(id => MODEL_ID.test(id)))].slice(0, 30);
  const results = new Map<string, ProbeResult>();
  const timestamps: number[] = [];
  let running = false;
  let catalog: { ids: string[]; listedAt: string } | null = null;
  function fresh(model: string) { const result = results.get(model); return result && now() - Date.parse(result.testedAt) < EXPIRY_MS ? result : null; }
  function availableRequests() { while (timestamps.length && timestamps[0]! <= now() - WINDOW_MS) timestamps.shift(); return MAX_REQUESTS - timestamps.length; }
  const status = () => ({ eligible, catalog, results: [...results.values()], requestsRemaining: availableRequests(), windowMs: WINDOW_MS, running, note: 'Results are synthetic smoke tests, not general accuracy rankings. Catalog presence does not mean free access. Only configured NVIDIA chat candidates may be probed. No partner endpoints or GPU downloads.' });
  async function call(path: '/models' | '/chat/completions', body: Record<string, unknown> | null, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (availableRequests() <= 0) throw new Error('MODEL_LAB_BUDGET');
    timestamps.push(now());
    return request(path, body, signal ? AbortSignal.any([signal, AbortSignal.timeout(35_000)]) : AbortSignal.timeout(35_000));
  }
  async function discover(signal?: AbortSignal) {
    if (catalog && now() - Date.parse(catalog.listedAt) < 10 * 60_000) return status();
    if (running) throw new Error('MODEL_LAB_BUSY');
    running = true;
    try {
      const response = await call('/models', null, signal);
      if (!response.ok) throw new Error('MODEL_LAB_CATALOG_HTTP_' + response.status);
      const data = object(await response.json())?.data;
      if (!Array.isArray(data)) throw new Error('MODEL_LAB_INVALID_CATALOG');
      const ids = [...new Set(data.slice(0, CATALOG_LIMIT).map(item => object(item)?.id).filter((id): id is string => typeof id === 'string' && MODEL_ID.test(id)))];
      catalog = { ids, listedAt: new Date(now()).toISOString() };
      return status();
    } finally { running = false; }
  }
  async function probe(model: string, signal?: AbortSignal): Promise<ProbeResult> {
    if (!eligible.includes(model)) throw new Error('MODEL_LAB_MODEL_NOT_ALLOWED');
    const existing = fresh(model); if (existing) return existing;
    if (running) throw new Error('MODEL_LAB_BUSY');
    if (availableRequests() < 2) throw new Error('MODEL_LAB_BUDGET');
    running = true;
    const started = now();
    let result: ProbeResult = { model, testedAt: new Date(started).toISOString(), status: 'failed', chat: false, turkish: false, reasoning: false, coding: false, tools: false, latencyMs: 0, requests: 0 };
    try {
      result = { ...result, requests: 1 };
      const response = await call('/chat/completions', { model, stream: false, max_tokens: 256, temperature: 0, messages: [{ role: 'user', content: TEST_MESSAGE }] }, signal);
      if (!response.ok) { result = { ...result, status: statusFor(response.status) }; }
      else {
        const msg = message(await response.json());
        const answer = parseAnswer(msg?.content);
        result = { ...result, status: msg && typeof msg.content === 'string' && msg.content.trim() ? 'passed' : 'invalid_response', chat: Boolean(typeof msg?.content === 'string' && msg.content.trim()), turkish: typeof answer?.capital === 'string' && answer.capital.trim().toLocaleLowerCase('tr-TR') === 'ankara', reasoning: answer?.math === 383, coding: answer?.code === 12 };
        if (result.chat) {
          result = { ...result, requests: 2 };
          const toolResponse = await call('/chat/completions', { model, stream: false, max_tokens: 256, temperature: 0, tools: [TEST_TOOL], tool_choice: 'auto', messages: [{ role: 'user', content: 'benchmark_echo aracını value=42 ile çağır. Metinle cevap verme.' }] }, signal);
          if (toolResponse.ok) {
            const calls = message(await toolResponse.json())?.tool_calls;
            const tools = Array.isArray(calls) && calls.length === 1 && (() => { const fn = object(object(calls[0])?.function); const args = parseAnswer(fn?.arguments); return fn?.name === 'benchmark_echo' && args?.value === 42 && Object.keys(args).length === 1; })();
            result = { ...result, tools };
          }
        }
      }
    } catch (error) { if (signal?.aborted) throw error; result = { ...result, status: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'failed' }; }
    finally { running = false; }
    result = { ...result, latencyMs: Math.max(0, now() - started) };
    results.set(model, result);
    return result;
  }
  /** Only successful exact-model observations influence order. Untested models remain fallback. */
  function preferred(kind: 'agent' | 'coding' | 'fast' | 'general', candidates: readonly string[]) {
    const verified = candidates.flatMap(model => { const row = fresh(model); return row?.status === 'passed' && row.chat && row.turkish && (kind !== 'agent' && kind !== 'coding' || row.tools) && (kind !== 'coding' || row.coding && row.reasoning) ? [row] : []; });
    if (kind === 'fast') verified.sort((a,b) => a.latencyMs-b.latencyMs);
    else verified.sort((a,b) => Number(b.reasoning)+Number(b.coding)+Number(b.tools)-Number(a.reasoning)-Number(a.coding)-Number(a.tools));
    return verified.map(row => row.model);
  }
  return Object.freeze({ status, discover, probe, preferred });
}
