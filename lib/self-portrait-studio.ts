/**
 * Hafize's mirror studio. Hafize imagines how it wants to look (concept), writes
 * the shader of that look (code), looks at the frames the owner's browser
 * rendered (reflect) and, when it is happy, ships it itself (publish): branch,
 * commit, pull request, CI, merge, Render release.
 *
 * Trust boundaries:
 * - Owner-only; the HTTP layer checks the authenticated owner session.
 * - The browser never supplies code. Publishing takes a candidate id and only
 *   commits GLSL that this server's own model calls produced and validated, as
 *   the single data file public/hafize-self-portrait.json.
 * - The browser supplies only rendered pixels (the mirror sheet) and the
 *   WebGL compiler log; both are treated as data in the prompts.
 * - Merge and release go through the existing audited github_release path with
 *   all its CI, branch, path and SHA checks.
 */
import { randomUUID } from 'node:crypto';
import {
  SELF_PORTRAIT_LIMITS, SELF_PORTRAIT_PATH, buildPortraitDocument, codeMessages, conceptMessages, extractPortraitCode,
  parseConcept, parseCritique, parseSheetDataUrl, reflectionPrompt, validatePortraitGlsl,
  type PortraitConcept, type PortraitCritique, type PortraitDocument
} from './self-portrait.ts';
import { completionOrigin } from './model-response-origin.ts';

type Json = Record<string, any>;
type Complete = (payload: Json, signal: AbortSignal, expertId?: string) => Promise<unknown>;
type StreamText = (payload: Json, signal: AbortSignal, expertId?: string) => Promise<{ readonly text: string; readonly model: string }>;
type Phase = (phase: string, detail?: Json) => void;
export type SelfPortraitPublisher = {
  readonly available: () => boolean;
  readonly publish: (doc: PortraitDocument, onPhase: Phase, signal: AbortSignal) => Promise<Json>;
};

export class SelfPortraitError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'SelfPortraitError'; this.code = code; this.status = status; }
}
const fail = (code: string, status = 400): never => { throw new SelfPortraitError(code, status); };

type Candidate = {
  readonly id: string; readonly glsl: string; readonly note: string; readonly model: string; readonly round: number;
  rendered: boolean; critique: PortraitCritique | null; critic: string;
};
type Session = {
  readonly id: string; readonly ownerId: string; readonly createdAt: number;
  concept: PortraitConcept; conceptModel: string;
  readonly candidates: Map<string, Candidate>; repairs: number; reflections: number; published: boolean;
};
type Job = {
  readonly id: string; readonly ownerId: string; readonly action: string; readonly createdAt: number;
  status: 'running' | 'done' | 'failed'; phase: string; updatedAt: number;
  readonly log: { at: string; phase: string; detail?: Json }[];
  result: Json | null; error: string | null; readonly abort: AbortController;
};

const SESSION_TTL = 3 * 60 * 60 * 1000;
const JOB_TTL = 2 * 60 * 60 * 1000;
const STEP_TIMEOUT = 8 * 60 * 1000;
const PUBLISH_TIMEOUT = 95 * 60 * 1000;

export function modelReplyText(result: unknown): string {
  const choices = result && typeof result === 'object' ? (result as Json).choices : null;
  const message = Array.isArray(choices) && choices[0] && typeof choices[0] === 'object' ? choices[0].message : null;
  const content = message && typeof message === 'object' ? message.content : null;
  const text = typeof content === 'string' ? content
    : Array.isArray(content) ? content.map((part: unknown) => part && typeof part === 'object' && typeof (part as Json).text === 'string' ? (part as Json).text : '').join('')
    : '';
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*<\/think>/i, '');
}
const modelOf = (result: unknown, fallback: string) => completionOrigin(result) ?? (result && typeof result === 'object' && typeof (result as Json).model === 'string' ? (result as Json).model : fallback);

export function createSelfPortraitStudio({
  complete, streamText, vision, visionModels, model, publisher = null, now = Date.now,
  log = (event: Json) => console.info('hafize.self_portrait ' + JSON.stringify(event))
}: {
  complete: Complete; streamText?: StreamText; vision: Complete; visionModels: readonly string[]; model: string;
  publisher?: SelfPortraitPublisher | null; now?: () => number; log?: (event: Json) => void;
}) {
  const sessions = new Map<string, Session>();
  const jobs = new Map<string, Job>();
  let publishing = false;

  function prune() {
    const t = now();
    for (const [id, s] of sessions) if (t - s.createdAt > SESSION_TTL) sessions.delete(id);
    for (const [id, j] of jobs) if (j.status !== 'running' && t - j.updatedAt > JOB_TTL) jobs.delete(id);
  }
  const session = (ownerId: string, id: unknown) => {
    const s = typeof id === 'string' ? sessions.get(id) : undefined;
    return s && s.ownerId === ownerId ? s : fail('SELF_PORTRAIT_SESSION_NOT_FOUND', 404);
  };
  const candidateOf = (s: Session, id: unknown) => {
    const c = typeof id === 'string' ? s.candidates.get(id) : undefined;
    return c ?? fail('SELF_PORTRAIT_CANDIDATE_NOT_FOUND', 404);
  };
  const publicCandidate = (c: Candidate) => ({ id: c.id, glsl: c.glsl, note: c.note, model: c.model, round: c.round, critique: c.critique });
  const publicConcept = (s: Session) => ({ ...s.concept, model: s.conceptModel });

  async function imagine(previous: PortraitConcept | null, signal: AbortSignal) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await complete({ model, messages: conceptMessages(previous), temperature: 0.95, max_tokens: 1800 }, signal, 'team-ux');
      const concept = parseConcept(modelReplyText(result));
      if (concept) return { concept, model: modelOf(result, model) };
    }
    return fail('SELF_PORTRAIT_CONCEPT_UNREADABLE', 502);
  }

  async function write(concept: PortraitConcept, revision: Parameters<typeof codeMessages>[1], signal: AbortSignal, round: number) {
    let current = revision;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const payload = { model, messages: codeMessages(concept, current), temperature: 0.55, max_tokens: 9000 };
      let text = '';
      let used = model;
      if (streamText) { const out = await streamText(payload, signal, 'team-ui'); text = out.text; used = out.model || model; }
      else { const result = await complete(payload, signal, 'team-ui'); text = modelReplyText(result); used = modelOf(result, model); }
      const extracted = extractPortraitCode(text);
      if (!extracted) { current = { glsl: current?.glsl ?? '', staticErrors: ['the reply had no ```glsl code block with hafizePortrait'] }; continue; }
      const check = validatePortraitGlsl(extracted.glsl);
      if (check.ok) return { id: randomUUID().replace(/-/g, '').slice(0, 16), glsl: check.glsl, note: extracted.note, model: used, round, rendered: false, critique: null, critic: '' } satisfies Candidate;
      current = { glsl: check.glsl, staticErrors: check.errors };
    }
    return fail('SELF_PORTRAIT_CODE_INVALID', 502);
  }

  async function reflect(concept: PortraitConcept, sheet: { mime: string; base64: string }, signal: AbortSignal) {
    for (const visionModel of visionModels) {
      const callSignal = AbortSignal.any([signal, AbortSignal.timeout(150_000)]);
      try {
        const nemotron = /nemotron/i.test(visionModel);
        const result = await vision({
          model: visionModel, stream: false, temperature: 0.2, max_tokens: nemotron ? 900 : 1600,
          ...(nemotron ? { chat_template_kwargs: { enable_thinking: false } } : {}),
          messages: [{ role: 'user', content: [{ type: 'text', text: reflectionPrompt(concept) }, { type: 'image_url', image_url: { url: 'data:' + sheet.mime + ';base64,' + sheet.base64 } }] }]
        }, callSignal);
        const critique = parseCritique(modelReplyText(result));
        if (critique) return { critique, model: visionModel };
        log({ event: 'reflect.unreadable', model: visionModel });
      } catch (error) {
        signal.throwIfAborted();
        log({ event: 'reflect.failed', model: visionModel, status: Number((error as Json)?.status) || null });
      }
    }
    return null;
  }

  function best(s: Session): Candidate | null {
    let top: Candidate | null = null;
    for (const c of s.candidates.values()) {
      if (!c.rendered) continue;
      if (!top || (c.critique?.score ?? -1) >= (top.critique?.score ?? -1)) top = c;
    }
    return top;
  }

  async function run(job: Job, input: Json): Promise<Json> {
    const phase: Phase = (name, detail) => {
      job.phase = name; job.updatedAt = now();
      job.log.push({ at: new Date(now()).toISOString(), phase: name, ...(detail ? { detail } : {}) });
      if (job.log.length > 60) job.log.splice(0, job.log.length - 60);
      log({ event: 'phase', action: job.action, phase: name });
    };
    const signal = job.abort.signal;
    if (job.action === 'imagine') {
      const previous = input.session ? session(job.ownerId, input.session).concept : null;
      phase('imagining');
      const idea = await imagine(previous, signal);
      const s: Session = { id: randomUUID(), ownerId: job.ownerId, createdAt: now(), concept: idea.concept, conceptModel: idea.model, candidates: new Map(), repairs: 0, reflections: 0, published: false };
      sessions.set(s.id, s);
      phase('imagined', { name: idea.concept.name });
      phase('coding');
      const c = await write(s.concept, undefined, signal, 0);
      s.candidates.set(c.id, c);
      phase('coded', { candidate: c.id });
      return { session: s.id, concept: publicConcept(s), candidate: publicCandidate(c) };
    }
    const s = session(job.ownerId, input.session);
    if (job.action === 'repair') {
      const c = candidateOf(s, input.candidate);
      if (s.repairs >= SELF_PORTRAIT_LIMITS.maxRepairs * 2) fail('SELF_PORTRAIT_REPAIR_LIMIT', 409);
      const compileLog = typeof input.compileLog === 'string' ? input.compileLog.replace(/[^\x09\x0a\x20-\x7e]/g, '').slice(0, 2500) : '';
      if (!compileLog.trim()) fail('SELF_PORTRAIT_COMPILE_LOG_REQUIRED');
      s.repairs += 1;
      phase('repairing');
      const next = await write(s.concept, { glsl: c.glsl, compileLog }, signal, c.round);
      s.candidates.set(next.id, next);
      phase('coded', { candidate: next.id });
      return { session: s.id, candidate: publicCandidate(next) };
    }
    if (job.action === 'reflect') {
      const c = candidateOf(s, input.candidate);
      const sheet = parseSheetDataUrl(input.sheet) ?? fail('SELF_PORTRAIT_SHEET_INVALID');
      c.rendered = true;
      s.reflections += 1;
      phase('reflecting');
      const seen = await reflect(s.concept, sheet, signal);
      if (!seen) {
        phase('reflected', { unavailable: true });
        return { session: s.id, critique: null, visionUnavailable: true, approved: false, best: best(s)?.id ?? c.id };
      }
      c.critique = seen.critique; c.critic = seen.model;
      phase('reflected', { score: seen.critique.score });
      if (seen.critique.score >= SELF_PORTRAIT_LIMITS.passScore) return { session: s.id, critique: seen.critique, critic: seen.model, approved: true, best: c.id };
      if (s.reflections >= SELF_PORTRAIT_LIMITS.maxReflections) return { session: s.id, critique: seen.critique, critic: seen.model, approved: false, exhausted: true, best: best(s)?.id ?? c.id };
      phase('revising');
      const next = await write(s.concept, { glsl: c.glsl, critique: seen.critique }, signal, c.round + 1);
      s.candidates.set(next.id, next);
      phase('coded', { candidate: next.id });
      return { session: s.id, critique: seen.critique, critic: seen.model, approved: false, candidate: publicCandidate(next) };
    }
    if (job.action === 'publish') {
      const shipper = publisher && publisher.available() ? publisher : fail('SELF_PORTRAIT_PUBLISH_UNAVAILABLE', 503);
      const c = candidateOf(s, input.candidate);
      if (!c.rendered) fail('SELF_PORTRAIT_NOT_SEEN_IN_MIRROR', 409);
      if (s.published) fail('SELF_PORTRAIT_ALREADY_PUBLISHED', 409);
      const stamp = new Date(now()).toISOString();
      const doc = buildPortraitDocument({
        id: 'ayna-' + stamp.slice(0, 10).replace(/-/g, '') + '-' + c.id.slice(0, 8),
        createdAt: stamp, concept: s.concept, glsl: c.glsl, critique: c.critique, rounds: s.reflections,
        models: { concept: s.conceptModel, code: c.model, critic: c.critic }
      });
      s.published = true;
      try {
        const out = await shipper.publish(doc, phase, signal);
        return { session: s.id, portrait: doc.id, name: doc.name, ...out };
      } catch (error) { s.published = false; throw error; }
    }
    return fail('SELF_PORTRAIT_ACTION_INVALID');
  }

  function snapshot(job: Job) {
    return { id: job.id, action: job.action, status: job.status, phase: job.phase, log: job.log, result: job.result, error: job.error, createdAt: new Date(job.createdAt).toISOString(), updatedAt: new Date(job.updatedAt).toISOString() };
  }

  function start(ownerId: string, body: Json) {
    prune();
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!['imagine', 'repair', 'reflect', 'publish'].includes(action)) fail('SELF_PORTRAIT_ACTION_INVALID');
    if ([...jobs.values()].some((j) => j.ownerId === ownerId && j.status === 'running' && (action !== 'publish' || j.action === 'publish'))) fail('SELF_PORTRAIT_BUSY', 409);
    if (action === 'publish' && publishing) fail('SELF_PORTRAIT_PUBLISH_BUSY', 409);
    if (action !== 'imagine' || body.session !== undefined) session(ownerId, body.session);
    const job: Job = { id: randomUUID(), ownerId, action, createdAt: now(), updatedAt: now(), status: 'running', phase: 'queued', log: [], result: null, error: null, abort: new AbortController() };
    jobs.set(job.id, job);
    const timer = setTimeout(() => job.abort.abort(new SelfPortraitError('SELF_PORTRAIT_TIMEOUT', 504)), action === 'publish' ? PUBLISH_TIMEOUT : STEP_TIMEOUT);
    timer.unref?.();
    if (action === 'publish') publishing = true;
    void run(job, body).then((result) => { job.result = result; job.status = 'done'; job.phase = 'done'; },
      (error) => {
        job.status = 'failed';
        job.error = error instanceof SelfPortraitError ? error.code : typeof (error as Json)?.code === 'string' && /^[A-Z0-9_]{3,80}$/.test((error as Json).code) ? (error as Json).code
          : (error as Json)?.name === 'AbortError' || (error as Json)?.name === 'TimeoutError' ? 'SELF_PORTRAIT_TIMEOUT' : 'SELF_PORTRAIT_FAILED';
        log({ event: 'failed', action, error: job.error });
      }).finally(() => { clearTimeout(timer); job.updatedAt = now(); if (action === 'publish') publishing = false; });
    return snapshot(job);
  }

  function get(ownerId: string, id: string) {
    const job = jobs.get(id);
    return job && job.ownerId === ownerId ? snapshot(job) : fail('SELF_PORTRAIT_JOB_NOT_FOUND', 404);
  }

  function status() {
    return { available: true, publishAvailable: Boolean(publisher?.available()), visionModels, limits: SELF_PORTRAIT_LIMITS, path: SELF_PORTRAIT_PATH };
  }

  return Object.freeze({ start, get, status });
}

type Release = { readonly execute: (args: unknown, ctx: Json) => Promise<Json> };
type Writer = {
  readonly configured: () => boolean;
  readonly normalizeInput: (kind: any, raw: unknown) => Json;
  readonly issueApproval: (kind: any, raw: unknown, approved?: boolean) => Json;
  readonly createBranch: (ticket: unknown, input: unknown) => Promise<Json>;
  readonly commitFile: (ticket: unknown, input: unknown) => Promise<Json>;
};

/** Ships an accepted portrait through the existing writer and release tool. */
export function createSelfPortraitPublisher({
  writer, release, fetchImpl, repository = 'umitalgan061-sudo/hafize', sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms); signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  }), now = Date.now, pollMs = 20_000
}: { writer: Writer; release: Release | null; fetchImpl: typeof fetch; repository?: string; sleep?: (ms: number, signal?: AbortSignal) => Promise<void>; now?: () => number; pollMs?: number }): SelfPortraitPublisher {
  async function api(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<{ status: number; data: Json | null }> {
    const response = await fetchImpl(new URL('https://api.github.com/repos/' + repository + path), {
      method, redirect: 'error',
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Hafize-Mirror', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000)
    });
    const text = await response.text();
    let data: Json | null = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: response.status, data };
  }
  const runsFor = async (sha: string, signal: AbortSignal) => {
    const { status, data } = await api('/actions/runs?head_sha=' + sha + '&per_page=100', 'GET', undefined, signal);
    if (status !== 200 || !Array.isArray(data?.workflow_runs)) return [];
    return (data!.workflow_runs as Json[]).filter((r) => r.head_sha === sha);
  };
  const cell = (text: string) => text.replace(/\|/g, '/');
  const BAD = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale']);
  const code = (error: unknown) => typeof (error as Json)?.code === 'string' ? (error as Json).code as string : '';

  return Object.freeze({
    available: () => Boolean(release) && writer.configured(),
    async publish(doc: PortraitDocument, phase: Phase, signal: AbortSignal) {
      if (!release) return fail('SELF_PORTRAIT_PUBLISH_UNAVAILABLE', 503);
      const ctx = { ownerAuthorized: true, authorization: { repositories: [repository], actions: ['open', 'merge', 'publish'], hafizePublishTarget: 'render' }, signal, reserveRender: () => true };
      const branch = 'hafize/auto-self-portrait-' + doc.id;
      const content = JSON.stringify(doc, null, 2) + '\n';
      phase('branch', { branch });
      const branchPayload = writer.normalizeInput('branch', { repository, branch, fromRef: 'main' });
      await writer.createBranch(writer.issueApproval('branch', branchPayload, true).ticket, branchPayload);
      phase('commit', { path: SELF_PORTRAIT_PATH });
      const existing = await api('/contents/' + SELF_PORTRAIT_PATH.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(branch), 'GET', undefined, signal);
      const existingSha = existing.status === 200 && typeof existing.data?.sha === 'string' ? existing.data.sha : undefined;
      if (existing.status !== 200 && existing.status !== 404) fail('SELF_PORTRAIT_READ_FAILED', 502);
      const filePayload = writer.normalizeInput('file', { repository, branch, path: SELF_PORTRAIT_PATH, content, message: 'Hafize self-portrait: ' + doc.name.slice(0, 120), ...(existingSha ? { existingSha } : {}) });
      await writer.commitFile(writer.issueApproval('file', filePayload, true).ticket, filePayload);
      phase('pull');
      const body = [
        '## Hafize kendi görünüşünü seçti: ' + doc.name, '',
        '> ' + doc.essence, '',
        '**Neden bu biçim:** ' + (doc.why || '—'), '',
        '**Tarif:** ' + doc.form, '',
        '| Hâl | Hafize\'nin tarifi |', '|---|---|',
        '| Boşta | ' + cell(doc.states.idle) + ' |', '| Dinliyor | ' + cell(doc.states.listening) + ' |', '| Düşünüyor | ' + cell(doc.states.thinking) + ' |', '| Konuşuyor | ' + cell(doc.states.speaking) + ' |', '',
        'Aynada kendine verdiği puan: ' + (doc.reflection.score ?? '—') + '/10' + (doc.reflection.verdict ? ' — ' + doc.reflection.verdict : ''), '',
        'Yalnız `' + SELF_PORTRAIT_PATH + '` değişir (GLSL fragment fonksiyonu + Hafize\'nin kendi tarifi). Ana ekran kartı bu dosyayı okur; tam ekran sesli sohbet küresi değişmez.',
        'Modeller — fikir: ' + (doc.models.concept || '—') + ', kod: ' + (doc.models.code || '—') + ', ayna: ' + (doc.models.critic || '—') + '.'
      ].join('\n').slice(0, 3900);
      const pull = await release.execute({ action: 'open', repository, branch, title: 'Hafize kendi görünüşünü seçti: ' + doc.name.slice(0, 120), body }, ctx);
      const number = Number(pull.number);
      if (!Number.isSafeInteger(number) || number < 1) fail('SELF_PORTRAIT_PULL_FAILED', 502);
      phase('ci', { number, url: pull.htmlUrl });
      const ciDeadline = now() + 45 * 60 * 1000;
      let merged: Json | null = null;
      let updates = 0;
      while (!merged) {
        if (now() > ciDeadline) fail('SELF_PORTRAIT_CI_TIMEOUT', 504);
        const pr = await api('/pulls/' + number, 'GET', undefined, signal);
        const head = typeof pr.data?.head?.sha === 'string' ? pr.data.head.sha : '';
        if (pr.data?.merged === true) { merged = { mergeCommitSha: pr.data.merge_commit_sha }; break; }
        if (pr.data?.state === 'closed') fail('SELF_PORTRAIT_PULL_CLOSED', 409);
        const runs = head ? await runsFor(head, signal) : [];
        if (runs.some((r) => r.status === 'completed' && BAD.has(r.conclusion))) fail('SELF_PORTRAIT_CI_FAILED', 409);
        const quality = runs.some((r) => String(r.path).split('@')[0] === '.github/workflows/quality.yml' && r.status === 'completed' && r.conclusion === 'success');
        if (head && quality && runs.every((r) => r.status === 'completed')) {
          try {
            merged = await release.execute({ action: 'merge', repository, number, sha: head }, ctx);
            break;
          } catch (error) {
            const c = code(error);
            if (c === 'RELEASE_BASE_MOVED' && updates < 4) {
              updates += 1;
              phase('updating-branch', { attempt: updates });
              await api('/pulls/' + number + '/update-branch', 'PUT', { expected_head_sha: head }, signal);
            } else if (!['RELEASE_BRANCH_PROTECTION_OR_CONFLICT', 'RELEASE_CI_NOT_GREEN', 'RELEASE_CI_EVIDENCE_INCOMPLETE', 'RELEASE_BASE_MOVED'].includes(c)) throw error;
          }
        }
        await sleep(pollMs, signal);
      }
      const mergeSha = String(merged.mergeCommitSha || '');
      if (!/^[a-f0-9]{40}$/.test(mergeSha)) fail('SELF_PORTRAIT_MERGE_UNCONFIRMED', 502);
      phase('merged', { number, mergeSha });
      const mainDeadline = now() + 45 * 60 * 1000;
      for (;;) {
        if (now() > mainDeadline) fail('SELF_PORTRAIT_MAIN_CI_TIMEOUT', 504);
        const runs = (await runsFor(mergeSha, signal)).filter((r) => String(r.path).split('@')[0] === '.github/workflows/quality.yml' && r.head_branch === 'main');
        if (runs.some((r) => r.status === 'completed' && r.conclusion === 'success')) break;
        if (runs.length && runs.every((r) => r.status === 'completed')) fail('SELF_PORTRAIT_MAIN_CI_FAILED', 409);
        await sleep(pollMs, signal);
      }
      phase('deploying', { mergeSha });
      let deploy = 'hook';
      try {
        const out = await release.execute({ action: 'publish', repository, sha: mergeSha, target: 'render' }, ctx);
        if (out.published === true) deploy = 'already-live';
      } catch (error) {
        const c = code(error);
        if (!['RELEASE_BASE_MOVED', 'RENDER_DEPLOY_HOOK_NOT_CONFIGURED', 'RENDER_DEPLOY_HOOK_INVALID', 'RENDER_ACTIVE_TASKS', 'RENDER_DEPLOY_HTTP_FAILED'].includes(c)) throw error;
        const dispatched = await api('/actions/workflows/hafize-render-release.yml/dispatches', 'POST', { ref: 'main' }, signal);
        deploy = dispatched.status === 204 ? 'workflow' : 'scheduled';
      }
      phase('deploy-requested', { deploy, mergeSha });
      return { number, url: 'https://github.com/' + repository + '/pull/' + number, mergeSha, deploy };
    }
  });
}
