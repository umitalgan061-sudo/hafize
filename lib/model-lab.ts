/** Bounded, synthetic NVIDIA probes. Never benchmark with conversation data or tools that have side effects. */
export type ProbeState = 'passed' | 'failed' | 'unavailable' | 'rate_limited' | 'quota' | 'timeout' | 'invalid_response' | 'auth_rejected';
export interface ProbeResult {
  readonly model: string;
  readonly testedAt: string;
  readonly status: ProbeState;
  readonly chat: boolean;
  readonly turkish: boolean;
  readonly reasoning: boolean;
  readonly coding: boolean;
  readonly tools: boolean;
  readonly toolProbeStatus: ProbeState | 'not_run';
  readonly latencyMs: number;
  readonly chatLatencyMs: number | null;
  readonly requests: number;
}
export type ModelTaskKind = 'agent' | 'coding' | 'fast' | 'general' | 'reasoning' | 'fast-agent' | 'reasoning-agent';
export interface DeepProbeResult {
  readonly model: string;
  readonly testedAt: string;
  readonly status: ProbeState;
  readonly language: boolean;
  readonly reasoning: boolean;
  readonly coding: boolean;
  readonly toolFollowup: boolean;
  readonly latencyMs: number;
}
const MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/;
const MAX_REQUESTS = 12;
const WINDOW_MS = 10 * 60_000;
const EXPIRY_MS = 24 * 60 * 60_000;
const CATALOG_LIMIT = 500;
const TEST_MESSAGE = 'Türkiye’nin başkentini, 17*23-8 işleminin sonucunu ve Python sum([2,4,6][::-1]) ifadesinin sonucunu hesapla. Yalnız geçerli JSON nesnesi yaz; alan adları capital (şehir), math (sayı), code (sayı).';
const TEST_TOOL = { type: 'function', function: { name: 'benchmark_echo', description: 'Sadece sentetik test: verilen sayıyı döndürür.', parameters: { type: 'object', properties: { value: { type: 'integer' } }, required: ['value'], additionalProperties: false } } };
const statusFor = (status: number): ProbeState => status === 401 ? 'auth_rejected' : status === 429 ? 'rate_limited' : status === 402 || status === 403 ? 'quota' : status === 404 || status === 410 ? 'unavailable' : 'failed';
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
  const deepResults = new Map<string, DeepProbeResult>();
  const timestamps: number[] = [];
  let running = false;
  let batchRunning = false;
  let blockedUntil = 0;
  let catalog: { ids: string[]; listedAt: string } | null = null;
  function fresh(model: string) { const result = results.get(model); const ttl = result?.status === 'passed' && result.toolProbeStatus === 'passed' ? EXPIRY_MS : result?.status === 'unavailable' ? 6 * 60 * 60_000 : WINDOW_MS; return result && now() - Date.parse(result.testedAt) < ttl ? result : null; }
  function availableRequests() { while (timestamps.length && timestamps[0]! <= now() - WINDOW_MS) timestamps.shift(); return MAX_REQUESTS - timestamps.length; }
  const status = () => ({ eligible, catalog, results: [...results.values()], deepResults: [...deepResults.values()], taskLeaders: Object.fromEntries((['general','fast','reasoning','coding','agent','fast-agent','reasoning-agent'] as const).map(kind => [kind, preferred(kind, eligible)])), requestsRemaining: availableRequests(), windowMs: WINDOW_MS, running: running || batchRunning, blockedUntil: blockedUntil > now() ? new Date(blockedUntil).toISOString() : null, pendingModels: eligible.filter(model => !fresh(model)), verifiedAgentModels: preferred('agent', eligible), note: 'Results are synthetic smoke tests, not general accuracy rankings. Catalog presence does not mean free access. Only configured NVIDIA chat candidates may be probed. No partner endpoints or GPU downloads.' });
  async function call(path: '/models' | '/chat/completions', body: Record<string, unknown> | null, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (blockedUntil > now()) throw new Error('MODEL_LAB_PROVIDER_PAUSED');
    if (availableRequests() <= 0) throw new Error('MODEL_LAB_BUDGET');
    timestamps.push(now());
    const response = await request(path, body, signal ? AbortSignal.any([signal, AbortSignal.timeout(35_000)]) : AbortSignal.timeout(35_000));
    if ([401, 402, 429].includes(response.status)) {
      const retry = response.headers.get('retry-after') || '';
      const requested = /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - now();
      const pause = response.status === 402 ? 60 * 60_000 : WINDOW_MS;
      blockedUntil = now() + Math.max(pause, Number.isFinite(requested) ? Math.min(requested, 60 * 60_000) : 0);
    }
    return response;
  }
  async function discover(signal?: AbortSignal) {
    if (catalog && now() - Date.parse(catalog.listedAt) < 10 * 60_000) return status();
    if (running || batchRunning) throw new Error('MODEL_LAB_BUSY');
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
  async function probeOne(model: string, signal?: AbortSignal): Promise<ProbeResult> {
    if (!eligible.includes(model)) throw new Error('MODEL_LAB_MODEL_NOT_ALLOWED');
    const existing = fresh(model); if (existing) return existing;
    if (running) throw new Error('MODEL_LAB_BUSY');
    if (blockedUntil > now()) throw new Error('MODEL_LAB_PROVIDER_PAUSED');
    if (availableRequests() < 2) throw new Error('MODEL_LAB_BUDGET');
    running = true;
    const started = now();
    let result: ProbeResult = { model, testedAt: new Date(started).toISOString(), status: 'failed', chat: false, turkish: false, reasoning: false, coding: false, tools: false, toolProbeStatus: 'not_run', latencyMs: 0, chatLatencyMs: null, requests: 0 };
    try {
      result = { ...result, requests: 1 };
      const response = await call('/chat/completions', { model, stream: false, max_tokens: 256, temperature: 0, messages: [{ role: 'user', content: TEST_MESSAGE }] }, signal);
      if (!response.ok) { result = { ...result, status: statusFor(response.status) }; }
      else {
        const msg = message(await response.json());
        const answer = parseAnswer(msg?.content);
        result = { ...result, chatLatencyMs: Math.max(0, now() - started) };
        result = { ...result, status: msg && typeof msg.content === 'string' && msg.content.trim() ? 'passed' : 'invalid_response', chat: Boolean(typeof msg?.content === 'string' && msg.content.trim()), turkish: typeof answer?.capital === 'string' && answer.capital.trim().toLocaleLowerCase('tr-TR') === 'ankara', reasoning: answer?.math === 383, coding: answer?.code === 12 };
        if (result.chat) {
          result = { ...result, requests: 2 };
          const toolResponse = await call('/chat/completions', { model, stream: false, max_tokens: 256, temperature: 0, tools: [TEST_TOOL], tool_choice: 'auto', messages: [{ role: 'user', content: 'benchmark_echo aracını value=42 ile çağır. Metinle cevap verme.' }] }, signal);
          if (toolResponse.ok) {
            const calls = message(await toolResponse.json())?.tool_calls;
            const tools = Array.isArray(calls) && calls.length === 1 && (() => { const fn = object(object(calls[0])?.function); const args = parseAnswer(fn?.arguments); return fn?.name === 'benchmark_echo' && args?.value === 42 && Object.keys(args).length === 1; })();
            result = { ...result, tools, toolProbeStatus: tools ? 'passed' : 'invalid_response' };
          } else result = { ...result, toolProbeStatus: statusFor(toolResponse.status) };
        }
      }
    } catch (error) { if (signal?.aborted) throw error; const failure = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'failed'; result = result.chat ? { ...result, toolProbeStatus: failure } : { ...result, status: failure }; }
    finally { running = false; }
    result = { ...result, latencyMs: Math.max(0, now() - started) };
    results.set(model, result);
    return result;
  }
  async function probe(model: string, signal?: AbortSignal) {
    if (batchRunning) throw new Error('MODEL_LAB_BUSY');
    return probeOne(model, signal);
  }
  /** Bounded foreground batch. Subsequent commands continue with the remaining untested candidates. */
  async function batch(signal?: AbortSignal, progress?: (model: string, result: ProbeResult) => void) {
    if (running || batchRunning) throw new Error('MODEL_LAB_BUSY');
    batchRunning = true;
    const completed: ProbeResult[] = [];
    try {
      for (const model of eligible.filter(id => !fresh(id)).slice(0, 2)) {
        signal?.throwIfAborted();
        if (blockedUntil > now() || availableRequests() < 2) break;
        const row = await probeOne(model, signal); completed.push(row); progress?.(model, row);
        if (['rate_limited', 'quota', 'auth_rejected'].includes(row.status) || ['rate_limited', 'quota', 'auth_rejected'].includes(row.toolProbeStatus)) break;
      }
      return { completed, pendingModels: eligible.filter(id => !fresh(id)), paused: blockedUntil > now() || availableRequests() < 2 };
    } finally { batchRunning = false; }
  }
  /** Separate opt-in deeper synthetic check: no real tool is invoked; the tool result is fabricated. */
  async function deepProbe(model: string, signal?: AbortSignal): Promise<DeepProbeResult> {
    if (!eligible.includes(model)) throw new Error('MODEL_LAB_MODEL_NOT_ALLOWED');
    if (!fresh(model)?.chat) throw new Error('MODEL_LAB_SMOKE_REQUIRED');
    const cached = deepResults.get(model);
    if (cached?.status === 'passed' && now() - Date.parse(cached.testedAt) < EXPIRY_MS) return cached;
    if (running || batchRunning) throw new Error('MODEL_LAB_BUSY');
    if (blockedUntil > now()) throw new Error('MODEL_LAB_PROVIDER_PAUSED');
    if (availableRequests() < 2) throw new Error('MODEL_LAB_BUDGET');
    running = true;
    const start = now();
    let result: DeepProbeResult = { model, testedAt: new Date(start).toISOString(), status: 'failed', language: false, reasoning: false, coding: false, toolFollowup: false, latencyMs: 0 };
    try {
      const response = await call('/chat/completions', { model, stream: false, max_tokens: 512, temperature: 0, messages: [{role:'user',content:'Sadece JSON nesnesi döndür. language: "Ankaraya gittim" cümlesinin doğru yazımı (noktalama dahil). reasoning: 3 kutuda sırasıyla 8, 13, 21 nesne var; toplamdan 7 çıkarıp ikiye böl. coding: Python [x*x for x in range(6) if x%2] sonucunu dizi olarak yaz.'}] }, signal);
      if (!response.ok) result = { ...result, status: statusFor(response.status) };
      else {
        const answer = parseAnswer(message(await response.json())?.content);
        result = { ...result, status: answer ? 'passed' : 'invalid_response', language: typeof answer?.language === 'string' && /^Ankara['’]ya gittim\.$/u.test(answer.language.trim()), reasoning: answer?.reasoning === 17.5, coding: JSON.stringify(answer?.coding) === '[1,9,25]' };
        if (fresh(model)?.tools && answer) {
          const follow = await call('/chat/completions', { model, stream: false, max_tokens: 256, temperature: 0, tools: [TEST_TOOL], tool_choice: 'auto', messages: [
            {role:'user',content:'benchmark_echo aracını value=42 ile çağır ve araç sonucundaki value değerine 3 ekle. Sonucu yalnız {"answer": sayı} biçiminde yaz.'},
            {role:'assistant',content:null,tool_calls:[{id:'benchmark_call_1',type:'function',function:{name:'benchmark_echo',arguments:'{"value":42}'}}]},
            {role:'tool',tool_call_id:'benchmark_call_1',content:'{"value":42}'}
          ] }, signal);
          if (follow.ok) result = { ...result, toolFollowup: parseAnswer(message(await follow.json())?.content)?.answer === 45 };
          else result = { ...result, status: statusFor(follow.status) };
        }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      result = { ...result, status: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'failed' };
    } finally { running = false; }
    result = { ...result, latencyMs: Math.max(0, now()-start) };
    deepResults.set(model,result);
    return result;
  }
  function deepFresh(model: string) {
    const row = deepResults.get(model);
    return row?.status === 'passed' && now()-Date.parse(row.testedAt)<EXPIRY_MS ? row : null;
  }
  /** Only successful exact-model observations influence order. Untested models remain fallback. */
  function preferred(kind: ModelTaskKind, candidates: readonly string[]) {
    const needsTools = kind.includes('agent') || kind === 'coding';
    const needsReasoning = kind.includes('reasoning') || kind === 'coding';
    const verified = candidates.flatMap(model => {
      const row = fresh(model);
      const deep = deepFresh(model);
      return row?.status === 'passed' && row.chat && row.turkish && (!needsTools || row.tools && (!deep || deep.toolFollowup)) && (!needsReasoning || row.reasoning && (!deep || deep.reasoning)) && (kind !== 'coding' || row.coding && (!deep || deep.coding)) ? [row] : [];
    });
    const latency = (row: ProbeResult) => row.chatLatencyMs ?? row.latencyMs;
    const score = (row: ProbeResult) => {
      const deep = deepFresh(row.model);
      return Number(row.reasoning)+Number(row.coding)+Number(row.tools) + (deep ? Number(deep.language) + Number(deep.reasoning) + Number(deep.coding) + Number(deep.toolFollowup) : 0);
    };
    if (kind.startsWith('fast')) verified.sort((a,b) => latency(a)-latency(b) || score(b)-score(a));
    else verified.sort((a,b) => score(b)-score(a) || latency(a)-latency(b));
    return verified.map(row => row.model);
  }
  return Object.freeze({ status, discover, probe, batch, deepProbe, preferred });
}

export function modelTaskKind(payload: Record<string, unknown>): ModelTaskKind {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const user = [...messages].reverse().map(object).find(row => row?.role === 'user');
  const content = user?.content;
  const raw = typeof content === 'string' ? content : Array.isArray(content) ? content.map(object).filter(part => part?.type === 'text').map(part => typeof part?.text === 'string' ? part.text : '').join(' ') : '';
  const text = raw.normalize('NFC').toLocaleLowerCase('tr-TR').trim();
  const tools = Array.isArray(payload.tools) && payload.tools.length > 0;
  // JS \b is ASCII-oriented; Turkish suffixes and dotted/dotless I require Unicode-aware boundaries.
  if (/(?:^|[^\p{L}\p{N}_])(?:kod[\p{L}]*|python|javascript|typescript|github|commit|debug|refactor|sql|powershell|programla[\p{L}]*|yazılım[\p{L}]*|hata[\p{L}]* ayıkla[\p{L}]*)(?=$|[^\p{L}\p{N}_])/u.test(text)) return 'coding';
  if (/^(?:merhaba|selam|naber|nasılsın|günaydın|iyi geceler|teşekkürler|sağ ol)[?!. ]*$/u.test(text)) return tools ? 'fast-agent' : 'fast';
  if (/(?:^|[^\p{L}\p{N}_])(?:matematik[\p{L}]*|mantık[\p{L}]*|hesapla[\p{L}]*|kanıtla[\p{L}]*|akıl yürüt[\p{L}]*|analiz[\p{L}]*)(?=$|[^\p{L}\p{N}_])/u.test(text)) return tools ? 'reasoning-agent' : 'reasoning';
  return tools ? 'agent' : 'general';
}
export function modelLabCommand(input: unknown): { action: 'status' | 'discover' | 'probe' | 'batch' | 'deep'; model?: string } | null {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (/^model laboratuvarı[?!.]?$/iu.test(text)) return { action: 'status' };
  if (/^nvidia modellerini listele[?!.]?$/iu.test(text)) return { action: 'discover' };
  if (/^model testlerine devam et[?!.]?$/iu.test(text) || /^nvidia model testlerini başlat[?!.]?$/iu.test(text)) return { action: 'batch' };
  const deep = /^model derin testi:\s*([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)\s*$/iu.exec(text);
  if (deep && MODEL_ID.test(deep[1]!)) return { action: 'deep', model: deep[1] };
  const match = /^model testi:\s*([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)\s*$/iu.exec(text);
  return match && MODEL_ID.test(match[1]!) ? { action: 'probe', model: match[1] } : null;
}
export function formatModelLabStatus(value: ReturnType<ReturnType<typeof createModelLab>['status']>): string {
  return [
    '**NVIDIA Model Laboratuvarı**',
    'Test edilebilir yapılandırılmış modeller: ' + value.eligible.join(', '),
    'API katalog sayısı: ' + (value.catalog ? value.catalog.ids.length : 'henüz sorgulanmadı'),
    ...(value.catalog ? ['API listesi: ' + value.catalog.ids.join(', ')] : []),
    'Kalan test API isteği (10 dakikalık pencere): ' + value.requestsRemaining,
    'Test sırası: ' + (value.pendingModels.join(', ') || 'güncel testler tamamlandı'),
    'Araç çağrısı doğrulanan modeller: ' + (value.verifiedAgentModels.join(', ') || 'henüz yok'),
    ...(value.blockedUntil ? ['Sağlayıcı bekleme süresi: ' + value.blockedUntil] : []),
    '',
    ...value.results.map(row => `${row.model} — ${row.status}; Türkçe: ${row.turkish}, mantık: ${row.reasoning}, kod: ${row.coding}, araç: ${row.toolProbeStatus}; ${row.latencyMs} ms; ${row.testedAt}`),
    '',
    'Göreve göre ölçülen öncelik: ' + Object.entries(value.taskLeaders).map(([kind,ids]) => kind + ': ' + (ids[0] || 'henüz yok')).join(' | '),
    ...value.deepResults.map(row => `Derin test ${row.model} — ${row.status}; Türkçe yazım: ${row.language}, mantık: ${row.reasoning}, kod: ${row.coding}, araç sonrası yanıt: ${row.toolFollowup}; ${row.testedAt}`),
    'Komutlar: NVIDIA modellerini listele · model testi: yayıncı/model · model derin testi: yayıncı/model · model testlerine devam et',
    'Testler kısa sentetik örneklerdir; genel zekâ sıralaması değildir. Ücretli partner veya GPU kiralama kullanılmaz. Katalogda bulunmak ücretsiz erişim kanıtı değildir. Sonuçlar sunucu yeniden başlatılana kadar bellekte saklanır.'
  ].join('\n');
}
