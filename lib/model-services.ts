// Model calls Hafize makes for itself (planning, claim extraction, summaries, critique), plus
// embeddings, vision, image generation and the content-safety classifier. NVIDIA is the primary
// provider; when it is unreachable and a local Ollama server is enabled, chat and embeddings fall
// back to it so the assistant keeps working offline.
import { createHash } from 'node:crypto';
import type { Telemetry } from './telemetry.ts';

type Json = Record<string, unknown>;
export type ChatCompletion = (payload: Json, signal?: AbortSignal) => Promise<unknown>;

export interface ModelServicesConfig {
  readonly apiKey: string;
  readonly nimBaseUrl?: string;
  readonly genaiBaseUrl?: string;
  readonly chat: ChatCompletion;
  readonly telemetry?: Telemetry | null;
  readonly fastModel?: string;
  readonly embedModel?: string;
  readonly rerankEnabled?: boolean;
  readonly visionModels?: readonly string[];
  readonly imageModel?: string;
  readonly safetyModel?: string;
  readonly local?: { readonly enabled: boolean; readonly baseUrl: string; readonly chatModel?: string; readonly embedModel?: string } | null;
  readonly fetchImpl?: typeof fetch;
}

export class ModelServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly providerDetail: string;
  constructor(code: string, status = 502, providerDetail = '') { super(code); this.name = 'ModelServiceError'; this.code = code; this.status = status; this.providerDetail = providerDetail.slice(0, 480); }
}

export const MODEL_SERVICE_DEFAULTS = Object.freeze({
  fastModel: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  embedModel: 'nvidia/nemotron-3-embed-1b',
  visionModels: Object.freeze(['nvidia/nemotron-3.5-super-vl-120b-a12b', 'meta/llama-3.2-11b-vision-instruct']),
  imageModel: 'black-forest-labs/flux.2-klein-4b',
  safetyModel: 'nvidia/nemotron-3.5-content-safety'
});

/** Pulls the first JSON object/array out of a model reply (tolerates code fences and prose). */
export function parseModelJson(text: string): unknown {
  const source = String(text || '').replace(/^﻿/, '').trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  for (const candidate of [fenced, source]) {
    if (!candidate) continue;
    try { return JSON.parse(candidate); } catch {}
    const start = candidate.search(/[[{]/);
    if (start < 0) continue;
    const open = candidate[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    for (let index = start; index < candidate.length; index += 1) {
      const character = candidate[index];
      if (inString) {
        if (character === '\\') index += 1;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === open) depth += 1;
      else if (character === close) {
        depth -= 1;
        if (depth === 0) {
          try { return JSON.parse(candidate.slice(start, index + 1)); } catch { break; }
        }
      }
    }
  }
  throw new ModelServiceError('MODEL_JSON_INVALID', 502);
}

function messageContent(completion: unknown): string {
  const choice = (completion as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => (part && typeof part === 'object' && typeof (part as Json).text === 'string' ? (part as Json).text : '')).join('');
  return '';
}

function isUnavailable(error: unknown): boolean {
  const status = Number((error as { status?: unknown })?.status);
  const name = String((error as { name?: unknown })?.name || '');
  const code = String((error as { code?: unknown })?.code || (error as Error)?.message || '');
  return name === 'UpstreamCircuitOpenError' || status === 429 || status >= 500 || /NOT_CONFIGURED|fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|UND_ERR/i.test(code) || (name === 'TypeError' && /fetch/i.test(code));
}

function imageProviderDetail(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const source = payload as { detail?: unknown; message?: unknown; error?: unknown };
  const detail = source.detail ?? source.message ?? source.error;
  const message = Array.isArray(detail)
    ? detail.map((row) => row && typeof row === 'object' ? `${Array.isArray((row as { loc?: unknown }).loc) ? `${(row as { loc: unknown[] }).loc.join('.')}: ` : ''}${String((row as { msg?: unknown }).msg ?? '')}` : String(row)).join('; ')
    : typeof detail === 'object' && detail ? String((detail as { message?: unknown }).message ?? '') : String(detail ?? '');
  return message.replace(/[\r\n\t]+/g, ' ').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').trim().slice(0, 480);
}

export function createModelServices(config: ModelServicesConfig) {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const nimBase = (config.nimBaseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
  const genaiBase = (config.genaiBaseUrl || 'https://ai.api.nvidia.com/v1/genai').replace(/\/+$/, '');
  const fastModel = config.fastModel || MODEL_SERVICE_DEFAULTS.fastModel;
  const embedModel = config.embedModel || MODEL_SERVICE_DEFAULTS.embedModel;
  const visionModels = config.visionModels?.length ? config.visionModels : MODEL_SERVICE_DEFAULTS.visionModels;
  const imageModel = config.imageModel || MODEL_SERVICE_DEFAULTS.imageModel;
  const safetyModel = config.safetyModel || MODEL_SERVICE_DEFAULTS.safetyModel;
  const local = config.local?.enabled ? config.local : null;
  const embedCache = new Map<string, number[]>();
  const embedDimensions = new Map<string, number>();
  let embeddingsBroken = false;
  let lastProvider: 'nvidia' | 'local' = 'nvidia';

  const authHeaders = () => ({ Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' });

  async function localChat(payload: Json, signal?: AbortSignal): Promise<unknown> {
    if (!local?.chatModel) throw new ModelServiceError('LOCAL_MODEL_NOT_CONFIGURED', 503);
    const response = await fetchImpl(`${local.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, model: local.chatModel, stream: false })
    }).catch(() => { throw new ModelServiceError('LOCAL_PROVIDER_UNAVAILABLE', 503); });
    if (!response.ok) throw new ModelServiceError('LOCAL_PROVIDER_ERROR', 502);
    return response.json();
  }

  /** Chat completion with automatic local fallback when NVIDIA is down. */
  async function complete(payload: Json, { signal, traceId = '', purpose = 'internal' }: { readonly signal?: AbortSignal | undefined; readonly traceId?: string; readonly purpose?: string } = {}): Promise<unknown> {
    try {
      const completion = await config.chat(payload, signal);
      lastProvider = 'nvidia';
      config.telemetry?.recordCompletionUsage(traceId, purpose, String(payload.model), completion);
      return completion;
    } catch (error) {
      if (!local || signal?.aborted || !isUnavailable(error)) throw error;
      const completion = await localChat(payload, signal);
      lastProvider = 'local';
      config.telemetry?.recordCompletionUsage(traceId, purpose, `local:${local.chatModel}`, completion);
      return completion;
    }
  }

  async function chatText({ system, user, traceId = '', purpose = 'internal', maxTokens = 1200, temperature = 0.2, model = fastModel, signal }: { readonly system: string; readonly user: string; readonly traceId?: string; readonly purpose?: string; readonly maxTokens?: number; readonly temperature?: number; readonly model?: string; readonly signal?: AbortSignal | undefined }): Promise<string> {
    const completion = await complete({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: maxTokens,
      temperature,
      stream: false,
      // The fast model is a reasoning model; internal calls want the answer, not the thinking.
      ...(model === fastModel ? { chat_template_kwargs: { enable_thinking: false } } : {})
    }, { signal, traceId, purpose });
    const text = messageContent(completion).trim();
    if (!text) throw new ModelServiceError('MODEL_EMPTY_RESPONSE', 502);
    return text;
  }

  /** Asks for JSON and parses it; one repair attempt when the first reply is not valid JSON. */
  async function chatJson<T = unknown>(input: { readonly system: string; readonly user: string; readonly traceId?: string; readonly purpose?: string; readonly maxTokens?: number; readonly model?: string; readonly signal?: AbortSignal | undefined }): Promise<T> {
    const system = `${input.system}\n\nYalnızca geçerli JSON döndür; açıklama, markdown veya kod bloğu ekleme.`;
    const first = await chatText({ ...input, system });
    try { return parseModelJson(first) as T; } catch {
      const repaired = await chatText({ ...input, system, user: `${input.user}\n\nÖnceki yanıtın geçerli JSON değildi. Aynı içeriği yalnızca geçerli JSON olarak tekrar yaz.` });
      return parseModelJson(repaired) as T;
    }
  }

  async function nvidiaEmbed(texts: readonly string[], inputType: 'query' | 'passage', signal?: AbortSignal): Promise<number[][]> {
    const response = await fetchImpl(`${nimBase}/embeddings`, {
      method: 'POST',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
      headers: authHeaders(),
      body: JSON.stringify({ model: embedModel, input: texts, input_type: inputType, encoding_format: 'float', truncate: 'END' })
    });
    if (!response.ok) throw new ModelServiceError(response.status === 404 ? 'EMBED_MODEL_UNAVAILABLE' : 'EMBED_FAILED', response.status);
    const data = await response.json() as { data?: Array<{ embedding?: number[]; index?: number }> };
    const rows = (data.data || []).slice().sort((a, b) => Number(a.index) - Number(b.index));
    if (rows.length !== texts.length || rows.some((row,index) => row.index !== index || !Array.isArray(row.embedding))) throw new ModelServiceError('EMBED_FAILED');
    return rows.map((row) => row.embedding!);
  }

  async function localEmbed(texts: readonly string[], signal?: AbortSignal): Promise<number[][]> {
    if (!local?.embedModel) throw new ModelServiceError('LOCAL_EMBED_NOT_CONFIGURED', 503);
    const response = await fetchImpl(`${local.baseUrl.replace(/\/+$/, '')}/api/embed`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: local.embedModel, input: texts })
    }).catch(() => { throw new ModelServiceError('LOCAL_PROVIDER_UNAVAILABLE', 503); });
    if (!response.ok) throw new ModelServiceError('LOCAL_EMBED_FAILED');
    const data = await response.json() as { embeddings?: number[][] };
    if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) throw new ModelServiceError('LOCAL_EMBED_FAILED');
    return data.embeddings;
  }

  /** One request must never mix different embedding spaces, even during provider failover. */
  async function embed(texts: readonly string[], { kind = 'passage', signal }: { readonly kind?: 'query' | 'passage'; readonly signal?: AbortSignal | undefined } = {}): Promise<{ vectors: number[][]; model: string } | null> {
    signal?.throwIfAborted();
    if (!texts.length) return { vectors: [], model: embedModel };
    const input=texts.map(text=>text.slice(0,8_000));
    async function collect(model:string, loader:(batch:readonly string[])=>Promise<number[][]>) {
      const keys=input.map(text=>createHash('sha256').update(JSON.stringify([model,kind,text])).digest('hex'));
      const found=keys.map(key=>embedCache.get(key));
      const missing=found.flatMap((vector,index)=>vector?[]:[index]);
      let dimension=embedDimensions.get(model);
      const staged: {key:string;vector:number[]}[]=[];
      for(let offset=0;offset<missing.length;offset+=32) {
        signal?.throwIfAborted();
        const indices=missing.slice(offset,offset+32);
        const vectors=await loader(indices.map(index=>input[index]!));
        if(vectors.length!==indices.length)throw new ModelServiceError('EMBED_FAILED');
        for(let i=0;i<vectors.length;i++){
          const vector=vectors[i]!;
          if(!Array.isArray(vector)||!vector.length||vector.length>16384||vector.some(value=>typeof value!=='number'||!Number.isFinite(value))||!vector.some(value=>value!==0))throw new ModelServiceError('EMBED_VECTOR_INVALID');
          if(dimension===undefined)dimension=vector.length;
          if(vector.length!==dimension)throw new ModelServiceError('EMBED_DIMENSION_MISMATCH');
          const index=indices[i]!;
          found[index]=vector;
          staged.push({key:keys[index]!,vector});
        }
      }
      signal?.throwIfAborted();
      if(dimension===undefined||found.some(vector=>!vector||vector.length!==dimension))throw new ModelServiceError('EMBED_DIMENSION_MISMATCH');
      embedDimensions.set(model,dimension);
      for(const row of staged)embedCache.set(row.key,row.vector);
      if(embedCache.size>5000)for(const key of [...embedCache.keys()].slice(0,embedCache.size-4000))embedCache.delete(key);
      return {vectors:found.map(vector=>vector!.slice()),model};
    }
    if(config.apiKey&&!embeddingsBroken){
      try{return await collect(embedModel,batch=>nvidiaEmbed(batch,kind,signal));}
      catch(error){if(signal?.aborted)throw error;if((error as ModelServiceError)?.code==='EMBED_MODEL_UNAVAILABLE')embeddingsBroken=true;}
    }
    if(local?.embedModel){
      try{return await collect('local:'+local.embedModel,batch=>localEmbed(batch,signal));}
      catch(error){if(signal?.aborted)throw error;}
    }
    return null;
  }

  /** Opt-in hosted reranking; relevance scores are not probabilities or factual verification. */
  async function rerank(query:string, passages:readonly string[], signal?:AbortSignal):Promise<{index:number;logit:number}[]|null>{
    signal?.throwIfAborted();
    if(!config.rerankEnabled||!config.apiKey||!query.trim()||passages.length<2||passages.length>32||passages.some(p=>!p.trim()))return null;
    try{
      const model='nvidia/nemotron-3.5-rerank-8b';
      const response=await fetchImpl('https://ai.api.nvidia.com/v1/retrieval/nvidia/nemotron-3.5-rerank-8b/reranking',{method:'POST',redirect:'error',headers:authHeaders(),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000),body:JSON.stringify({model,query:{text:query.slice(0,2000)},passages:passages.map(text=>({text:text.slice(0,2000)})),truncate:'END'})});
      if(!response.ok)return null;
      const rows=(await response.json() as {rankings?:{index:number;logit:number}[]}).rankings;
      if(!Array.isArray(rows)||rows.length!==passages.length||rows.some(row=>!row||!Number.isInteger(row.index)||row.index<0||row.index>=passages.length||typeof row.logit!=='number'||!Number.isFinite(row.logit))||new Set(rows.map(row=>row.index)).size!==passages.length)return null;
      return rows.map(({index,logit})=>({index,logit})).sort((a,b)=>b.logit-a.logit||a.index-b.index);
    }catch(error){if(signal?.aborted)throw error;return null;}
  }

  /** Describes images with a vision model: description, visible text, objects, structured data. */
  async function vision({ images, prompt, traceId = '', signal }: { readonly images: readonly { readonly mime: string; readonly base64: string }[]; readonly prompt?: string; readonly traceId?: string; readonly signal?: AbortSignal | undefined }): Promise<{ text: string; model: string }> {
    if (!images.length) throw new ModelServiceError('VISION_NO_IMAGES', 400);
    const instruction = prompt?.trim() || 'Bu görseli Türkçe olarak ayrıntılı açıkla. Görseldeki tüm yazıları aynen aktar (OCR), önemli nesneleri listele; tablo, grafik veya diyagram varsa verilerini yapılandırılmış biçimde çıkar.';
    let lastError: unknown = null;
    for (const model of visionModels) {
      try {
        const completion = await config.chat({
          model,
          max_tokens: 2_500,
          temperature: 0.1,
          stream: false,
          // Nemotron VL reasons before answering; with thinking on a description takes minutes.
          ...(/nemotron/i.test(model) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
          messages: [{ role: 'user', content: [{ type: 'text', text: instruction }, ...images.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } }))] }]
        }, signal);
        config.telemetry?.recordCompletionUsage(traceId, 'vision', model, completion);
        const text = messageContent(completion).trim();
        if (text) return { text, model };
      } catch (error) {
        lastError = error;
        if (signal?.aborted) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new ModelServiceError('VISION_FAILED');
  }

  /** Text-to-image through NVIDIA's hosted generator. */
  async function generateImage({ prompt, width = 1024, height = 1024, seed, steps = 4, signal }: { readonly prompt: string; readonly width?: number; readonly height?: number; readonly seed?: number | undefined; readonly steps?: number; readonly signal?: AbortSignal | undefined }): Promise<{ bytes: Buffer; mime: string; seed: number; model: string }> {
    if (!config.apiKey) throw new ModelServiceError('NVIDIA_NOT_CONFIGURED', 503);
    const usedSeed = Number.isInteger(seed) ? Number(seed) : Math.floor(Math.random() * 2_147_483_647);
    const response = await fetchImpl(`${genaiBase}/${imageModel}`, {
      method: 'POST',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
      headers: authHeaders(),
      // Keep the full, documented FLUX contract. The hosted endpoint validates
      // its image-generation mode strictly and returns HTTP 422 for partial or
      // unsupported dimension payloads.
      body: JSON.stringify({ mode: 'Image Generation', prompt, width, height, cfg_scale: 0, image: null, samples: 1, seed: usedSeed, steps })
    });
    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      let payload: unknown = raw;
      try { payload = raw ? JSON.parse(raw) : null; } catch {}
      const detail = imageProviderDetail(payload);
      const filtered = /safety|content.?filter|policy|moderation/i.test(detail);
      // A 400/422 is usually a provider contract error, not a rejected prompt.
      throw new ModelServiceError(filtered ? 'IMAGE_CONTENT_FILTERED' : response.status === 422 || response.status === 400 ? 'IMAGE_REQUEST_INVALID' : 'IMAGE_GENERATION_FAILED', response.status, detail);
    }
    const data = await response.json() as { artifacts?: Array<{ base64?: string; finishReason?: string; seed?: number }> };
    const artifact = data.artifacts?.[0];
    if (!artifact?.base64) throw new ModelServiceError('IMAGE_GENERATION_FAILED');
    if (artifact.finishReason && /CONTENT_FILTERED|ERROR/i.test(artifact.finishReason)) throw new ModelServiceError('IMAGE_CONTENT_FILTERED', 422);
    const bytes = Buffer.from(artifact.base64, 'base64');
    const png=bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(!png&&!jpeg)throw new ModelServiceError('IMAGE_GENERATION_INVALID_FORMAT');
    const mime = png ? 'image/png' : 'image/jpeg';
    return { bytes, mime, seed: Number.isInteger(artifact.seed) ? Number(artifact.seed) : usedSeed, model: imageModel };
  }

  /** Content-safety verdict for a user prompt (Nemotron safety guard). Fails open only when the classifier is unreachable. */
  async function safetyCheck(text: string, { traceId = '', signal }: { readonly traceId?: string; readonly signal?: AbortSignal | undefined } = {}): Promise<{ safe: boolean; categories: string; checked: boolean }> {
    try {
      const completion = await config.chat({ model: safetyModel, max_tokens: 60, stream: false, messages: [{ role: 'user', content: String(text).slice(0, 4_000) }] }, signal);
      config.telemetry?.recordCompletionUsage(traceId, 'safety', safetyModel, completion);
      const verdict = messageContent(completion);
      const match = verdict.match(/User Safety:\s*(unsafe|safe)\b/i);
      if (!match) return { safe: true, categories: '', checked: false };
      return { safe: match[1]?.toLowerCase()==='safe', categories: verdict.match(/Safety Categories:\s*(.+)/i)?.[1]?.trim() || '', checked: true };
    } catch {
      return { safe: true, categories: '', checked: false };
    }
  }

  return Object.freeze({
    complete, chatText, chatJson, embed, rerank, vision, generateImage, safetyCheck,
    get lastProvider() { return lastProvider; },
    get embeddingsAvailable() { return !embeddingsBroken || Boolean(local?.embedModel); },
    models: Object.freeze({ fastModel, embedModel, visionModels, imageModel, safetyModel })
  });
}
export type ModelServices = ReturnType<typeof createModelServices>;
