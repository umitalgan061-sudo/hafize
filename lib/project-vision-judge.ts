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
 */

type Json = Record<string, unknown>;
type Complete = (payload: Json, signal?: AbortSignal) => Promise<unknown>;

export const VISION_JUDGE_TASK = 'face-realism-rank';
export const VISION_JUDGE_PROJECTS: ReadonlySet<string> = new Set(['retake']);
export const VISION_JUDGE_DEFAULT_MODELS: readonly string[] = Object.freeze([
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
  'meta/llama-3.2-11b-vision-instruct',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'
]);
export const VISION_JUDGE_LIMITS = Object.freeze({
  minCandidates: 2,
  maxCandidates: 4,
  maxModels: 4,
  maxImageBytes: 600 * 1024,
  maxTotalBytes: 2_000_000,
  /** base64 is 4/3 of the decoded size; JSON framing stays well below the remainder. */
  maxBodyBytes: 2_800_000,
  callTimeoutMs: 40_000,
  minVotes: 2,
  minAgreement: 2 / 3,
  minScoreMargin: 0.5
});
export const VISION_JUDGE_ISSUES: readonly string[] = Object.freeze([
  'seam', 'tone', 'lighting', 'waxy', 'eyes', 'teeth', 'warp', 'sharpness', 'ghost'
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

export function judgePrompt(count: number): string {
  const letters = LETTERS.slice(0, count).join(', ');
  return [
    `You are a strict photo retouching quality reviewer. Images ${letters} are alternative edits of the SAME photograph; only the face region differs between them.`,
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
  return typeof content === 'string' ? content : '';
}

export function createProjectVisionJudge({complete, models = VISION_JUDGE_DEFAULT_MODELS}: {complete: Complete; models?: readonly string[]}) {
  const judgeModels = Object.freeze([...models].slice(0, VISION_JUDGE_LIMITS.maxModels));

  async function judge(project: string, input: unknown, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!VISION_JUDGE_PROJECTS.has(project)) fail('PROJECT_AI_TASK_NOT_ALLOWED', 403);
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('PROJECT_AI_INVALID_INPUT');
    const args = input as Json;
    if (Object.keys(args).some((key) => key !== 'task' && key !== 'candidates')) fail('PROJECT_AI_INVALID_INPUT');
    if (args.task !== VISION_JUDGE_TASK) fail('PROJECT_AI_INVALID_TASK');
    const raw = args.candidates;
    if (!Array.isArray(raw) || raw.length < VISION_JUDGE_LIMITS.minCandidates || raw.length > VISION_JUDGE_LIMITS.maxCandidates) fail('PROJECT_AI_INVALID_INPUT');
    const images = (raw as unknown[]).map(decodeJudgeImage);
    if (images.reduce((total, image) => total + image.bytes, 0) > VISION_JUDGE_LIMITS.maxTotalBytes) fail('PROJECT_AI_IMAGE_TOO_LARGE', 413);

    const count = images.length;
    const prompt = judgePrompt(count);
    const jobs = judgeModels.flatMap((model) => judgeOrders(count).map((order) => ({model, order})));
    const settled = await Promise.allSettled(jobs.map(async ({model, order}) => {
      const content: Json[] = [{type: 'text', text: prompt}];
      order.forEach((candidate, position) => {
        const image = images[candidate];
        content.push({type: 'text', text: `Image ${LETTERS[position]}:`});
        content.push({type: 'image_url', image_url: {url: `data:${image.mime};base64,${image.base64}`}});
      });
      const callSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(VISION_JUDGE_LIMITS.callTimeoutMs)]) : AbortSignal.timeout(VISION_JUDGE_LIMITS.callTimeoutMs);
      const result = await complete({
        model,
        stream: false,
        temperature: 0,
        max_tokens: 400,
        // Nemotron VL/Omni reason before answering; a ranking must fit the request window.
        ...(/nemotron/i.test(model) ? {chat_template_kwargs: {enable_thinking: false}} : {}),
        messages: [{role: 'user', content}]
      }, callSignal);
      const vote = parseJudgeVote(messageText(result), order);
      return {vote, model: completionOrigin(result) ?? model};
    }));
    signal?.throwIfAborted();

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
      models: [...answeringModels].sort(),
      imagesStored: false,
      toolsExecuted: false
    };
  }

  return Object.freeze({
    judge,
    status: () => ({models: [...judgeModels], projects: [...VISION_JUDGE_PROJECTS], task: VISION_JUDGE_TASK})
  });
}
