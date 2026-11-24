import type {RuntimeAttempt} from './model-runtime-evidence.ts';
import {waitForFirstVoiceText} from './voice-first-text.ts';
// Which model answers. Requests start at the top of the chain and fall one step whenever a model is
// out of quota, rate limited, unavailable, failing or too slow to start. A model that failed sits
// out for a while and is then tried first again, so the top model is always used when it works.
// Measured with scripts/rank-models.mjs; override with HAFIZE_MODEL_CHAIN.

export const DEFAULT_MODEL_CHAIN = Object.freeze([
  'nvidia/nemotron-3-ultra-550b-a55b',
  'nvidia/nemotron-3.5-bolt-e4b',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'stepfun-ai/step-5-preview',
  'minimaxai/minimax-m3.1-flash',
  'mistralai/mistral-large-4-1t-a52b',
  'meta/muse-glimmer-30b'
]);

const MINUTE = 60_000;
const COOLDOWN_MS = Object.freeze({ quota: 60 * MINUTE, rate: MINUTE, missing: 360 * MINUTE, failing: MINUTE / 2, slow: MINUTE / 2 });
// Streaming replies start at once, so silence means trouble. A non-streaming reply arrives whole.
const FIRST_RESPONSE_MS = Object.freeze({ stream: 25_000, whole: 90_000 });
const MAX_RETRY_AFTER_MS = 60 * MINUTE;
// These have one job a general model cannot do. Vision requests also carry images.
const SINGLE_PURPOSE = /safety|guard|(?:^|[-/])vl(?:[-/]|$)|vision|embed|rerank|transcrib|parakeet|whisper|(?:^|[-/])tts(?:[-/]|$)|(?:^|[-/])ocr(?:[-/]|$)/i;

export type FailureReason = keyof typeof COOLDOWN_MS;

/** Why a response means "try the next model", or null when it does not. 401 is the key, not the model. */
export function failureReason(status: number): FailureReason | null {
  if (status === 402 || status === 403) return 'quota';
  if (status === 429) return 'rate';
  if (status === 404 || status === 410) return 'missing';
  if (status === 408 || status >= 500) return 'failing';
  return null;
}

export function parseModelChain(value: unknown): readonly string[] {
  const listed = String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  return listed.length ? [...new Set(listed)] : DEFAULT_MODEL_CHAIN;
}

function carriesImages(payload: Record<string, unknown>): boolean {
  const messages = Array.isArray(payload.messages) ? payload.messages as { content?: unknown }[] : [];
  return messages.some((message) => Array.isArray(message.content) && message.content.some((part) => ['image_url','input_audio','audio_url','video_url','input_video','input_image','file'].includes(String((part as { type?: unknown })?.type))));
}

type Send = (body: string, signal: AbortSignal) => Promise<Response>;

interface ModelState { cooldownUntil: number; lastFailure: FailureReason | null; lastFailureAt: number; lastSuccessAt: number }

export function createModelRouter({ chain = DEFAULT_MODEL_CHAIN, keepFirst = [], preferredModels = () => [], extraCandidates = [], observeAttempt = () => {}, now = Date.now, log = (line: string) => console.log(line) }: { readonly chain?: readonly string[]; readonly keepFirst?: readonly string[]; readonly preferredModels?: (payload: Record<string, unknown>, candidates: readonly string[], expertId?: string) => readonly string[]; readonly extraCandidates?: readonly string[]; readonly observeAttempt?: (event:RuntimeAttempt)=>void; readonly now?: () => number; readonly log?: (line: string) => void } = {}) {
  const states = new Map<string, ModelState>();
  // Bind response identity to the actual routed model, not the most recent concurrent request.
  const responseModels = new WeakMap<Response,string>();
  let current = chain[0] ?? '';

  const state = (model: string): ModelState => {
    let found = states.get(model);
    if (!found) { found = { cooldownUntil: 0, lastFailure: null, lastFailureAt: 0, lastSuccessAt: 0 }; states.set(model, found); }
    return found;
  };
  const ready = (model: string) => state(model).cooldownUntil <= now();
  const observe=(event:RuntimeAttempt)=>{try{observeAttempt(event);}catch{/* telemetry must not break chat */}};

  function penalize(model: string, reason: FailureReason, retryAfterMs = 0): void {
    const entry = state(model);
    entry.cooldownUntil = now() + (retryAfterMs > 0 ? Math.min(retryAfterMs, MAX_RETRY_AFTER_MS) : COOLDOWN_MS[reason]);
    entry.lastFailure = reason;
    entry.lastFailureAt = now();
  }

  /**
   * Attempts in order. A model named in keepFirst (an internal fast job) goes first, anything else
   * starts at the top whatever the client asked for. When everything is cooling down the full list
   * runs anyway: a stale cooldown must never be the reason a question goes unanswered.
   */
  function attemptsFor(requested: string, payload: Record<string, unknown>, expertId?: string): string[] {
    const candidates = [...new Set([...chain, ...extraCandidates])];
    const measured = preferredModels(payload, candidates, expertId).filter(model => candidates.includes(model));
    const ordered = keepFirst.includes(requested) ? [requested, ...chain.filter((model) => model !== requested)] : [...new Set([...measured, ...chain])];
    const available = ordered.filter(ready);
    return available.length ? available : ordered;
  }

  const shouldRoute = (payload: Record<string, unknown>) => typeof payload.model === 'string' && !SINGLE_PURPOSE.test(payload.model) && !carriesImages(payload) && chain.length > 0;

  function bodyFor(payload: Record<string, unknown>, model: string): string {
    const next: Record<string, unknown> = { ...payload, model };
    // Reasoning models think before the first word; a chat reply wants the word. Others reject the field.
    if (/lightning/i.test(model)) next.chat_template_kwargs = { enable_thinking: false };
    else delete next.chat_template_kwargs;
    return JSON.stringify(next);
  }

  /** Sends one chat request down the chain. The last response is returned unread, whatever it was. */
  async function send(rawBody: string, deliver: Send, signal?: AbortSignal | null, expertId?: string, voiceFast=false): Promise<Response> {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const allAttempts = attemptsFor(String(payload.model), payload, expertId);
    const streaming = payload.stream === true;
    const voice = voiceFast && streaming;
    // Prefer configured quick candidates over the large general reasoning models, without inventing model IDs.
    const attempts = voice ? [...allAttempts.filter(id=>id===payload.model||/lightning|bolt|flash/i.test(id)),...allAttempts.filter(id=>id!==payload.model&&!/lightning|bolt|flash/i.test(id))].slice(0,3) : allAttempts;
    let lastError: unknown = null;
    for (const [index, model] of attempts.entries()) {
      const isLast = index === attempts.length - 1;
      const attempt = new AbortController();
      signal?.throwIfAborted();
      const requestSignal = signal ? AbortSignal.any([signal, attempt.signal]) : attempt.signal;
      let timedOut = false;
      const started=now();
      // The last model also has a finite time to response headers. Once headers arrive,
      // streaming remains cancellable by the caller and is not subject to this timer.
      const timer = setTimeout(() => { timedOut = true; attempt.abort(); }, voice ? 8_000 : streaming ? FIRST_RESPONSE_MS.stream : FIRST_RESPONSE_MS.whole);
      try {
        let response = await deliver(bodyFor(payload, model), requestSignal);
        if(voice && response.ok)response=await waitForFirstVoiceText(response,requestSignal);
        if (timer) clearTimeout(timer);
        responseModels.set(response,model);
        if (response.ok) {
          observe({model,outcome:'headers_ok',latencyMs:Math.max(0,now()-started)});
          const entry = state(model);
          entry.cooldownUntil = 0;
          entry.lastFailure = null;
          entry.lastSuccessAt = now();
          if (model !== current) log(`hafize.model ${JSON.stringify({ from: current, to: model })}`);
          current = model;
          return response;
        }
        const reason = failureReason(response.status);
        // A rejected key or a malformed request fails the same way everywhere.
        if (!reason) return response;
        observe({model,outcome:'provider_failure',latencyMs:Math.max(0,now()-started)});
        const wait = response.headers.get('retry-after')?.trim() ?? '';
        const retryAfter = /^\d+$/.test(wait) ? Number(wait) * 1000 : Date.parse(wait) - now();
        penalize(model, reason, Number.isFinite(retryAfter) ? retryAfter : 0);
        if (isLast) return response;
        log(`hafize.model ${JSON.stringify({ skipped: model, reason, status: response.status })}`);
        await response.body?.cancel().catch(() => {});
      } catch (error) {
        if (timer) clearTimeout(timer);
        // The user stopped it: nothing is wrong with the model.
        if (signal?.aborted) throw error;
        lastError = error;
        const reason: FailureReason = timedOut ? 'slow' : 'failing';
        observe({model,outcome:timedOut?'slow':'provider_failure',latencyMs:Math.max(0,now()-started)});
        penalize(model, reason);
        if (isLast) throw error;
        log(`hafize.model ${JSON.stringify({ skipped: model, reason })}`);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('MODEL_CHAIN_EMPTY');
  }

  /** A stream broke after it began: the model that answered sits out and the round can be retried. */
  const penalizeCurrent = (reason: FailureReason = 'failing') => { if (current) penalize(current, reason); };
  const modelFor = (response: Response) => responseModels.get(response) ?? null;
  const penalizeModel = (model: string | null, reason: FailureReason = 'failing') => { if (model && (chain.includes(model) || extraCandidates.includes(model))) {penalize(model,reason);observe({model,outcome:'stream_failure',latencyMs:0});} };

  const status = () => ({
    top: chain[0] ?? '',
    current,
    extraCandidates: extraCandidates.filter(model => !chain.includes(model)).map(model => ({model,ready:ready(model),lastFailure:state(model).lastFailure,retryInSeconds:ready(model)?0:Math.ceil((state(model).cooldownUntil-now())/1000)})),
    chain: chain.map((model) => {
      const entry = state(model);
      return { model, ready: ready(model), lastFailure: entry.lastFailure, retryInSeconds: ready(model) ? 0 : Math.ceil((entry.cooldownUntil - now()) / 1000), lastSuccessAt: entry.lastSuccessAt ? new Date(entry.lastSuccessAt).toISOString() : null };
    })
  });

  return Object.freeze({ send, shouldRoute, penalizeCurrent, modelFor, penalizeModel, status, top: () => chain[0] ?? '' });
}
