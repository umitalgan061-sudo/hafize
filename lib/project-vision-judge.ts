import {completionOrigin} from './model-response-origin.ts';
import {parseModelJson} from './model-services.ts';

/**
 * Retake'in NVIDIA görsel jürisi (backend-to-backend).
 *
 * Retake'in yerel motoru aynı fotoğrafın kimliği eşit 2-4 sonuç adayını gönderir;
 * birden fazla ücretsiz NVIDIA görsel modeli, adayları iki farklı sırayla
 * fotoğraf gerçekliği için puanlar. Yanıt yalnız sıralama ve kusur etiketleridir.
 *
 * Sınırlar: istemci model, prompt, araç veya URL seçemez; görseller saklanmaz,
 * loglanmaz, kimlik tespiti istenmez. Oylar dağınıksa jüri karar vermez ("abstain")
 * ve Retake kendi yerel ArcFace/doku seçimini korur.
 *
 * v2: dört farklı üreticiden güncel çok kipli ücretsiz uç nokta (bağımsız
 * oylar), yanıt vermeyenlerin yerine yedek modeller ve isteğe bağlı "inceleme
 * paftası" düzeni: her adayda tüm yüzün yanında göz ve ağız yakın planları,
 * çünkü görsel modeller büyük görselleri küçültür ve ince kusurları kaçırır.
 */

type Json = Record<string, unknown>;
type Complete = (payload: Json, signal?: AbortSignal) => Promise<unknown>;

export const VISION_JUDGE_TASK = 'face-realism-rank';
export const VISION_JUDGE_PROJECTS: ReadonlySet<string> = new Set(['retake']);
// Four vendors, so one model family's taste cannot outvote the others.
export const VISION_JUDGE_DEFAULT_MODELS: readonly string[] = Object.freeze([
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
  'mistralai/mistral-large-4-1t-a52b',
  'stepfun-ai/step-5-preview',
  'z-ai/glm-5.3-flash'
]);
// Asked only when too few panel models answered (missing, throttled, no image input).
export const VISION_JUDGE_RESERVE_MODELS: readonly string[] = Object.freeze([
  'meta/muse-glimmer-30b',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  'meta/llama-3.2-11b-vision-instruct'
]);
export const VISION_JUDGE_LAYOUTS: readonly string[] = Object.freeze(['face', 'review-sheet']);
export const VISION_JUDGE_LIMITS = Object.freeze({
  minCandidates: 2,
  maxCandidates: 4,
  maxModels: 4,
  maxImageBytes: 600 * 1024,
  maxTotalBytes: 2_000_000,
  /** base64 is 4/3 of the decoded size; JSON framing stays well below the remainder. */
  maxBodyBytes: 2_800_000,
  callTimeoutMs: 40_000,
  maxParallelCalls: 4,
  /** Fewer answering panel models than this → ask reserves, while time allows. */
  minAnsweringModels: 3,
  maxReserveModels: 2,
  reserveStartBeforeMs: 85_000,
  /** The gateway's own deadline for a jury request (Retake waits 190 s). */
  requestDeadlineMs: 175_000,
  minVotes: 2,
  minAgreement: 2 / 3,
  minScoreMargin: 0.5
});
/**
 * Roster health (in memory, numbers only). Free catalog models disappear or
 * stall without notice; a model that keeps failing is benched for a while and
 * a reserve takes its seat in the first batch instead of after ~85 s of waiting.
 * Rate limits (429) are shared-key pressure, not a broken model: neutral.
 */
export const VISION_JUDGE_HEALTH = Object.freeze({
  windowCalls: 24,
  benchAfterFailures: 4,
  benchMs: 15 * 60_000,
  /** Two consecutive 404/410 replies: the model left the free catalog. */
  missingAfterFailures: 2,
  missingBenchMs: 2 * 60 * 60_000
});
type ModelHealth = {outcomes: string[]; latencies: number[]; consecutive: number; missing: number; benchedUntil: number};

export const VISION_JUDGE_ISSUES: readonly string[] = Object.freeze([
  'seam', 'tone', 'lighting', 'waxy', 'eyes', 'teeth', 'warp', 'sharpness', 'ghost', 'grain', 'catchlight'
]);
const LETTERS = ['A', 'B', 'C', 'D'] as const;
const MODEL_ID = /^[a-z0-9][a-z0-9_.-]{0,80}\/[a-z0-9][a-z0-9_.-]{0,120}$/i;

const fail = (code: string, status = 400): never => {
  throw Object.assign(new Error(code), {code, status});
};

/** Operator override (HAFIZE_RETAKE_JUDGE_MODELS); malformed values fall back to the audited defaults. */
export function parseJudgeModels(value?: string | null): string[] {
  if (!value || !value.trim()) return [...VISION_JUDGE_DEFAULT_MODELS];
  const models = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (!models.length || models.length > VISION_JUDGE_LIMITS.maxModels || models.some((item) => !MODEL_ID.test(item)) || new Set(models).size !== models.length) {
    return [...VISION_JUDGE_DEFAULT_MODELS];
  }
  return models;
}

type DecodedImage = {mime: 'image/jpeg' | 'image/png'; base64: string; bytes: number};

export function decodeJudgeImage(value: unknown): DecodedImage {
  if (typeof value !== 'string') return fail('PROJECT_AI_INVALID_IMAGE');
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value as string);
  if (!match) return fail('PROJECT_AI_INVALID_IMAGE');
  const mime = match[1] as DecodedImage['mime'];
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length < 16 || buffer.length > VISION_JUDGE_LIMITS.maxImageBytes) return fail('PROJECT_AI_IMAGE_TOO_LARGE', 413);
  const png = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if ((mime === 'image/png' && !png) || (mime === 'image/jpeg' && !jpeg)) return fail('PROJECT_AI_INVALID_IMAGE');
  return {mime, base64, bytes: buffer.length};
}

export function judgePrompt(count: number, layout = 'face'): string {
  const letters = LETTERS.slice(0, count).join(', ');
  const sheet = layout === 'review-sheet' ? [
    'Each image is a review sheet of one edit: the whole face with its surroundings on the left; on the right, enlarged close-ups of the SAME edit: the eyes and eyebrows (top) and the mouth (bottom).',
    'Use the close-ups for fine detail: eyelashes, iris texture and the catchlight reflection in the eyes, eyebrow hairs, lip lines, teeth, pores and grain. Judge the edit as a whole; do not reward an image for the sheet layout itself.'
  ] : [];
  return [
    `You are a strict photo retouching quality reviewer. Images ${letters} are alternative edits of the SAME photograph; only the face region differs between them.`,
    ...sheet,
    'Decide which edit looks most like an untouched photo straight from a camera.',
    'Look for: visible seams, halos or dark outlines around the face; skin tone or lighting on the face that does not match the forehead, ears, neck or the rest of the photo;',
    'waxy, plastic or over-smoothed skin; blurry, mismatched or warped eyes, teeth or eyebrows; distorted proportions; sharpness or noise that differs from the surrounding photo; ghosted double edges.',
    'Ignore who the person is, attractiveness, age, expression and pose. Do not identify or describe the person.',
    `Score every image from 1 (obviously edited) to 10 (indistinguishable from a real photo). The best image must have the highest score.`,
    `Issue tags allowed: ${VISION_JUDGE_ISSUES.join(', ')}.`,
    'Reply with JSON only, no prose: {"scores":{"A":7,"B":5},"best":"A","issues":{"A":[],"B":["seam","waxy"]}}'
  ].join(' ');
}

/** Two presentation orders cancel most position bias of VLM judges. */
export function judgeOrders(count: number): number[][] {
  const forward = Array.from({length: count}, (_, index) => index);
  return [forward, [...forward].reverse()];
}

export type JudgeVote = {best: number; scores: number[]; issues: string[][]};

/** Maps one model reply back to candidate indices; inconsistent or partial replies are discarded. */
export function parseJudgeVote(text: string, order: readonly number[]): JudgeVote | null {
  let parsed: unknown;
  try { parsed = parseModelJson(text); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const reply = parsed as Json;
  const rawScores = reply.scores;
  if (!rawScores || typeof rawScores !== 'object' || Array.isArray(rawScores)) return null;
  const count = order.length;
  const scores = new Array<number>(count).fill(0);
  const issues = Array.from({length: count}, () => [] as string[]);
  const rawIssues = reply.issues && typeof reply.issues === 'object' && !Array.isArray(reply.issues) ? reply.issues as Json : {};
  for (let position = 0; position < count; position += 1) {
    const letter = LETTERS[position];
    const value = Number((rawScores as Json)[letter]);
    if (!Number.isFinite(value) || value < 1 || value > 10) return null;
    const candidate = order[position];
    scores[candidate] = value;
    const tags = rawIssues[letter];
    if (Array.isArray(tags)) {
      issues[candidate] = [...new Set(tags.filter((tag): tag is string => typeof tag === 'string' && VISION_JUDGE_ISSUES.includes(tag)))];
    }
  }
  const bestLetter = typeof reply.best === 'string' ? reply.best.trim().toUpperCase() : '';
  const bestPosition = LETTERS.slice(0, count).indexOf(bestLetter as (typeof LETTERS)[number]);
  if (bestPosition < 0) return null;
  const best = order[bestPosition];
  if (scores[best] < Math.max(...scores)) return null;
  return {best, scores, issues};
}

export type JudgeVerdict = {
  decision: 'winner' | 'abstain';
  winner: number | null;
  votes: number;
  agreement: number;
  meanScores: number[];
  issues: Array<Record<string, number>>;
  reason: string;
};

export function aggregateJudgeVotes(votes: readonly JudgeVote[], count: number): JudgeVerdict {
  const meanScores = new Array<number>(count).fill(0);
  const firsts = new Array<number>(count).fill(0);
  const issues = Array.from({length: count}, () => ({} as Record<string, number>));
  for (const vote of votes) {
    firsts[vote.best] += 1;
    vote.scores.forEach((score, index) => { meanScores[index] += score / votes.length; });
    vote.issues.forEach((tags, index) => { for (const tag of tags) issues[index][tag] = (issues[index][tag] || 0) + 1; });
  }
  const rounded = meanScores.map((score) => Math.round(score * 100) / 100);
  const abstain = (reason: string): JudgeVerdict => ({decision: 'abstain', winner: null, votes: votes.length, agreement: 0, meanScores: votes.length ? rounded : [], issues: votes.length ? issues : [], reason});
  if (votes.length < VISION_JUDGE_LIMITS.minVotes) return abstain('NOT_ENOUGH_VOTES');
  const ranked = meanScores.map((score, index) => ({score, index})).sort((a, b) => b.score - a.score || a.index - b.index);
  const winner = ranked[0].index;
  const agreement = Math.round((firsts[winner] / votes.length) * 1000) / 1000;
  if (agreement < VISION_JUDGE_LIMITS.minAgreement) return {...abstain('SPLIT_VOTE'), agreement};
  if (ranked[0].score - ranked[1].score < VISION_JUDGE_LIMITS.minScoreMargin) return {...abstain('NARROW_MARGIN'), agreement};
  return {decision: 'winner', winner, votes: votes.length, agreement, meanScores: rounded, issues, reason: 'CONSENSUS'};
}

function messageText(result: unknown): string {
  const choices = result && typeof result === 'object' ? (result as Json).choices : null;
  const first = Array.isArray(choices) && choices.length ? choices[0] : null;
  const message = first && typeof first === 'object' ? (first as Json).message : null;
  const content = message && typeof message === 'object' ? (message as Json).content : null;
  const text = typeof content === 'string' ? content
    : Array.isArray(content) ? content.map((part) => part && typeof part === 'object' && typeof (part as Json).text === 'string' ? (part as Json).text : '').join('')
    : '';
  // Reasoning models may think aloud first; only the answer after it counts.
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*<\/think>/i, '');
}

export function createProjectVisionJudge({complete, models = VISION_JUDGE_DEFAULT_MODELS, reserves = VISION_JUDGE_RESERVE_MODELS, now = Date.now}: {complete: Complete; models?: readonly string[]; reserves?: readonly string[]; now?: () => number}) {
  const judgeModels = Object.freeze([...models].slice(0, VISION_JUDGE_LIMITS.maxModels));
  const reserveModels = Object.freeze([...reserves].filter((model) => MODEL_ID.test(model) && !judgeModels.includes(model)).slice(0, VISION_JUDGE_LIMITS.maxReserveModels));
  const health = new Map<string, ModelHealth>();
  const healthOf = (model: string): ModelHealth => {
    let row = health.get(model);
    if (!row) { row = {outcomes: [], latencies: [], consecutive: 0, missing: 0, benchedUntil: 0}; health.set(model, row); }
    return row;
  };
  const isBenched = (model: string, at = now()) => (health.get(model)?.benchedUntil ?? 0) > at;
  const noteOutcome = (model: string, outcome: string, elapsedMs: number) => {
    const row = healthOf(model);
    row.outcomes.push(outcome);
    if (row.outcomes.length > VISION_JUDGE_HEALTH.windowCalls) row.outcomes.shift();
    if (outcome === 'http-429') return;
    if (outcome === 'valid-vote') {
      row.consecutive = 0; row.missing = 0; row.benchedUntil = 0;
      row.latencies.push(Math.max(0, Math.round(elapsedMs)));
      if (row.latencies.length > VISION_JUDGE_HEALTH.windowCalls) row.latencies.shift();
      return;
    }
    row.consecutive += 1;
    row.missing = outcome === 'http-404' || outcome === 'http-410' ? row.missing + 1 : 0;
    if (row.missing >= VISION_JUDGE_HEALTH.missingAfterFailures) row.benchedUntil = now() + VISION_JUDGE_HEALTH.missingBenchMs;
    else if (row.consecutive >= VISION_JUDGE_HEALTH.benchAfterFailures) row.benchedUntil = now() + VISION_JUDGE_HEALTH.benchMs;
  };
  /** Benched panel seats go to healthy reserves; an all-benched panel with no spare is asked anyway. */
  const roster = () => {
    const at = now();
    const benched = judgeModels.filter((model) => isBenched(model, at));
    const active = judgeModels.filter((model) => !benched.includes(model));
    const spares = reserveModels.filter((model) => !isBenched(model, at));
    const substitutes = spares.slice(0, benched.length);
    const seated = [...active, ...substitutes];
    if (!seated.length) return {seated: [...judgeModels], substitutes: [] as string[], benched: [] as string[], spares};
    return {seated, substitutes, benched, spares: spares.filter((model) => !substitutes.includes(model))};
  };
  const healthStatus = () => {
    const at = now();
    const models: Record<string, {calls: number; valid: number; timeouts: number; rateLimited: number; failures: number; medianMs: number | null; benchedForS: number}> = {};
    for (const [model, row] of health) {
      const sorted = [...row.latencies].sort((a, b) => a - b);
      models[model] = {
        calls: row.outcomes.length,
        valid: row.outcomes.filter((outcome) => outcome === 'valid-vote').length,
        timeouts: row.outcomes.filter((outcome) => outcome === 'timeout').length,
        rateLimited: row.outcomes.filter((outcome) => outcome === 'http-429').length,
        failures: row.outcomes.filter((outcome) => outcome !== 'valid-vote' && outcome !== 'http-429').length,
        medianMs: sorted[Math.floor(sorted.length / 2)] ?? null,
        benchedForS: row.benchedUntil > at ? Math.ceil((row.benchedUntil - at) / 1000) : 0
      };
    }
    return {benched: [...health.keys()].filter((model) => isBenched(model, at)), models};
  };

  async function judge(project: string, input: unknown, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!VISION_JUDGE_PROJECTS.has(project)) fail('PROJECT_AI_TASK_NOT_ALLOWED', 403);
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('PROJECT_AI_INVALID_INPUT');
    const args = input as Json;
    if (Object.keys(args).some((key) => key !== 'task' && key !== 'candidates' && key !== 'layout')) fail('PROJECT_AI_INVALID_INPUT');
    if (args.task !== VISION_JUDGE_TASK) fail('PROJECT_AI_INVALID_TASK');
    const layout = args.layout === undefined ? 'face' : args.layout;
    if (typeof layout !== 'string' || !VISION_JUDGE_LAYOUTS.includes(layout)) fail('PROJECT_AI_INVALID_INPUT');
    const raw = args.candidates;
    if (!Array.isArray(raw) || raw.length < VISION_JUDGE_LIMITS.minCandidates || raw.length > VISION_JUDGE_LIMITS.maxCandidates) fail('PROJECT_AI_INVALID_INPUT');
    const images = (raw as unknown[]).map(decodeJudgeImage);
    if (images.reduce((total, image) => total + image.bytes, 0) > VISION_JUDGE_LIMITS.maxTotalBytes) fail('PROJECT_AI_IMAGE_TOO_LARGE', 413);

    const count = images.length;
    const prompt = judgePrompt(count, layout as string);
    const jobsFor = (list: readonly string[]) => list.flatMap((model) => judgeOrders(count).map((order) => ({model, order})));
    const seats = roster();
    const jobs = jobsFor(seats.seated);
    const juryStarted = now();
    const diagnostics: Array<{model: string; order: 'forward' | 'reverse'; outcome: string; elapsedMs: number}> = [];
    const runVote = async ({model, order}: (typeof jobs)[number]) => {
      const started = now();
      const direction = order[0] === 0 ? 'forward' as const : 'reverse' as const;
      const record = (outcome: string) => {
        const row = {model, order: direction, outcome, elapsedMs: now() - started};
        diagnostics.push(row);
        noteOutcome(model, outcome, row.elapsedMs);
        // No provider messages, prompts, images, or credentials in logs.
        console.info('hafize.retake.jury.model ' + JSON.stringify(row));
      };
      signal?.throwIfAborted();
      const content: Json[] = [{type: 'text', text: prompt}];
      order.forEach((candidate, position) => {
        const image = images[candidate];
        content.push({type: 'text', text: `Image ${LETTERS[position]}:`});
        content.push({type: 'image_url', image_url: {url: `data:${image.mime};base64,${image.base64}`}});
      });
      const callSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(VISION_JUDGE_LIMITS.callTimeoutMs)]) : AbortSignal.timeout(VISION_JUDGE_LIMITS.callTimeoutMs);
      try {
      const result = await complete({
        model,
        stream: false,
        temperature: 0,
        // Nemotron VL/Omni can skip their reasoning; other reasoning models
        // need room to think before the JSON answer.
        max_tokens: /nemotron/i.test(model) ? 400 : 1200,
        ...(/nemotron/i.test(model) ? {chat_template_kwargs: {enable_thinking: false}} : {}),
        messages: [{role: 'user', content}]
      }, callSignal);
      const vote = parseJudgeVote(messageText(result), order);
      const origin = completionOrigin(result) ?? model;
      if (origin !== model) { record('model-mismatch'); return {vote: null, model}; }
      record(vote ? 'valid-vote' : 'invalid-vote');
      return {vote, model};
      } catch (error) {
        const status = Number((error as {status?: unknown})?.status);
        const name = (error as {name?: unknown})?.name;
        record(callSignal.aborted || name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : Number.isInteger(status) && status >= 400 && status <= 599 ? `http-${status}` : 'upstream-error');
        throw error;
      }
    };
    // Bound memory pressure and upstream fan-out on the free Render instance.
    // Each model still sees both orders; no partial batch can silently become
    // an authoritative vote after the client disconnects.
    const settled: PromiseSettledResult<Awaited<ReturnType<typeof runVote>>>[] = [];
    const runBatches = async (list: ReturnType<typeof jobsFor>) => {
      for (let offset = 0; offset < list.length; offset += VISION_JUDGE_LIMITS.maxParallelCalls) {
        signal?.throwIfAborted();
        settled.push(...await Promise.allSettled(list.slice(offset, offset + VISION_JUDGE_LIMITS.maxParallelCalls).map(runVote)));
      }
    };
    await runBatches(jobs);
    signal?.throwIfAborted();
    // Too few independent panel models answered: ask reserves while time allows.
    const answered = () => new Set(settled.flatMap((row) => row.status === 'fulfilled' && row.value.vote ? [row.value.model] : [])).size;
    const reservesAsked: string[] = [];
    const spares = seats.spares.filter((model) => !isBenched(model));
    if (answered() < VISION_JUDGE_LIMITS.minAnsweringModels && spares.length && now() - juryStarted < VISION_JUDGE_LIMITS.reserveStartBeforeMs) {
      const needed = Math.min(spares.length, VISION_JUDGE_LIMITS.minAnsweringModels - answered());
      reservesAsked.push(...spares.slice(0, needed));
      const reserveJobs = jobsFor(reservesAsked);
      jobs.push(...reserveJobs);
      await runBatches(reserveJobs);
      signal?.throwIfAborted();
    }

    const votes: JudgeVote[] = [];
    const answeringModels = new Set<string>();
    let rateLimited = 0;
    let rejected = 0;
    for (const row of settled) {
      if (row.status === 'rejected') {
        rejected += 1;
        if (Number((row.reason as {status?: unknown})?.status) === 429) rateLimited += 1;
        continue;
      }
      if (row.value.vote) {
        votes.push(row.value.vote);
        answeringModels.add(row.value.model);
      }
    }
    if (rejected === jobs.length) fail(rateLimited === jobs.length ? 'PROJECT_AI_UPSTREAM_LIMIT' : 'PROJECT_AI_UPSTREAM_FAILED', rateLimited === jobs.length ? 429 : 502);
    const verdict = aggregateJudgeVotes(votes, count);
    return {
      project,
      task: VISION_JUDGE_TASK,
      ...verdict,
      attempted: jobs.length,
      attemptedModels: [...seats.seated, ...reservesAsked],
      reserveModels: [...seats.substitutes, ...reservesAsked],
      benchedModels: seats.benched,
      layout,
      diagnostics,
      elapsedMs: now() - juryStarted,
      models: [...answeringModels].sort(),
      imagesStored: false,
      toolsExecuted: false
    };
  }

  return Object.freeze({
    judge,
    status: () => ({models: [...judgeModels], reserveModels: [...reserveModels], layouts: [...VISION_JUDGE_LAYOUTS], projects: [...VISION_JUDGE_PROJECTS], task: VISION_JUDGE_TASK, health: healthStatus()})
  });
}
