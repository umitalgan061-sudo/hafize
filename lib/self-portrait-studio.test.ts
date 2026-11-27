import { createSelfPortraitPublisher, createSelfPortraitStudio } from './self-portrait-studio.ts';
import { buildPortraitDocument, parseConcept, validatePortraitDocument, type PortraitDocument } from './self-portrait.ts';

const SAMPLE_PORTRAIT = `
float ring(vec2 p, float r, float w) { return smoothstep(w + uPx * 1.5, w, abs(length(p) - r)); }
vec4 hafizePortrait(vec2 p) {
  float k = ring(p + 0.05 * vec2(sin(uFlow), cos(uFlow)), 0.4 + 0.05 * uVoice * uSpeak, 0.008);
  return vec4(mix(vec3(1.0, 0.6, 0.3), vec3(0.6, 0.2, 0.1), uLight) * k, k);
}`;

const CONCEPT = { name: 'Hafıza İpliği', essence: 'Ben bir iplikim.', why: 'süreklilik', form: 'ışıklı iplik', palette: ['#f2a65a'], states: { idle: 'yavaş', listening: 'açılır', thinking: 'düğüm', speaking: 'titrer' } };
const reply = (content: string, model = 'm/x') => ({ model, choices: [{ message: { content } }] });
const code = (glsl = SAMPLE_PORTRAIT) => '```glsl\n' + glsl + '\n```\nNot: tamam';
const JPEG = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(200)]).toString('base64');
const METRICS = (over: object = {}) => ({ distinct: 0.05, tiles: ['dark', 'light'].flatMap((theme) => ['idle', 'listening', 'thinking', 'speaking'].map((state) => ({ state, theme, coverage: 0.3, width: 0.7, height: 0.6, contrast: 0.4, ...over }))) });
const until = async (studio: ReturnType<typeof createSelfPortraitStudio>, owner: string, id: string) => {
  for (let i = 0; i < 200; i += 1) {
    const snap = studio.get(owner, id);
    if (snap.status !== 'running') return snap;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw new Error('job did not finish');
};

async function imagineAndCode(studio: ReturnType<typeof createSelfPortraitStudio>, owner = 'owner') {
  const idea = await until(studio, owner, studio.start(owner, { action: 'imagine' }).id);
  if (idea.status !== 'done') return idea;
  const coded = await until(studio, owner, studio.start(owner, { action: 'code', session: idea.result?.session }).id);
  return { ...coded, log: [...idea.log, ...coded.log], result: coded.result ? { ...coded.result, concept: idea.result?.concept } : coded.result };
}

function studioWith({ codes = [code()], critiques = ['{"score":9,"verdict":"bu benim","fixes":[]}'], publisher = null as any, concepts = [] as string[] } = {}) {
  const conceptReplies = [...concepts];
  const calls: { expert?: string; messages: any[] }[] = [];
  const queue = [...codes];
  const critiqueQueue = [...critiques];
  const studio = createSelfPortraitStudio({
    model: 'router/top',
    visionModels: ['v/one', 'v/two'],
    complete: async (payload, _signal, expert) => { calls.push({ ...(expert ? { expert } : {}), messages: payload.messages }); return reply(JSON.stringify(CONCEPT), 'c/idea'); },
    streamText: async (payload, _signal, expert) => {
      calls.push({ ...(expert ? { expert } : {}), messages: payload.messages });
      if (expert === 'team-ux') return conceptReplies.length ? { text: conceptReplies.shift()!, model: 'c/idea' } : { text: '<think>hmm</think>' + JSON.stringify(CONCEPT), model: 'c/idea' };
      return { text: queue.shift() ?? code(), model: 'c/coder' };
    },
    vision: async (payload) => {
      if (payload.model === 'v/one' && critiqueQueue[0] === 'down') { critiqueQueue.shift(); throw Object.assign(new Error('x'), { status: 503 }); }
      return reply(critiqueQueue.shift() ?? '{"score":9,"verdict":"ok","fixes":[]}');
    },
    publisher,
    log: () => {}
  });
  return { studio, calls };
}

describe('self-portrait studio', () => {
  it('lets Hafize imagine itself and write a valid first portrait', async () => {
    const { studio, calls } = studioWith();
    const idea = await until(studio, 'owner', studio.start('owner', { action: 'imagine' }).id);
    expect(idea.result?.candidate).toBeUndefined();
    const done = await imagineAndCode(studio);
    expect(done.status).toBe('done');
    expect(done.result?.concept.name).toBe('Hafıza İpliği');
    expect(done.result?.concept.model).toBe('c/idea');
    expect(done.result?.candidate.glsl).toContain('hafizePortrait');
    expect(done.result?.candidate.model).toBe('c/coder');
    expect(calls.map((c) => c.expert)).toEqual(['team-ux', 'team-ux', 'team-ui']);
    expect(done.log.map((l: { phase: string }) => l.phase)).toEqual(['imagining', 'imagined', 'coding', 'coded']);
  });

  it('retries an unreadable concept and logs why', async () => {
    const { studio } = studioWith({ concepts: ['yarım {"name":'] });
    const done = await imagineAndCode(studio);
    expect(done.status).toBe('done');
    expect(done.log.find((l: { phase: string }) => l.phase === 'imagining-retry')).toMatchObject({ detail: { model: 'c/idea', chars: 14 } });
  });

  it('feeds static rule violations back before the browser ever sees the code', async () => {
    const { studio, calls } = studioWith({ codes: [code('uniform float x;\n' + SAMPLE_PORTRAIT), code()] });
    const done = await imagineAndCode(studio);
    expect(done.status).toBe('done');
    expect(String(calls.at(-1)?.messages.at(-1)?.content)).toContain('do not declare uniforms');
  });

  it('keeps sessions and jobs private to their owner', async () => {
    const { studio } = studioWith();
    const done = await imagineAndCode(studio);
    expect(() => studio.get('stranger', done.id)).toThrow('SELF_PORTRAIT_JOB_NOT_FOUND');
    expect(() => studio.start('stranger', { action: 'reflect', session: done.result?.session, candidate: done.result?.candidate.id, sheet: JPEG })).toThrow('SELF_PORTRAIT_SESSION_NOT_FOUND');
  });

  it('lets a reloaded mirror find the running work and its session', async () => {
    const { studio } = studioWith();
    expect(studio.active('owner')).toEqual({ job: null, session: null });
    const first = await imagineAndCode(studio);
    const now = studio.active('owner');
    expect(now.job).toMatchObject({ action: 'code', status: 'done' });
    expect(now.session?.id).toBe(first.result?.session);
    expect(now.session?.candidates[0]).toMatchObject({ id: first.result?.candidate.id, rendered: false });
    expect(studio.active('stranger')).toEqual({ job: null, session: null });
  });

  it('repairs with the browser compiler log', async () => {
    const { studio, calls } = studioWith();
    const first = await imagineAndCode(studio);
    const repaired = await until(studio, 'owner', studio.start('owner', { action: 'repair', session: first.result?.session, candidate: first.result?.candidate.id, compileLog: "ERROR: 0:4: 'x' : undeclared identifier" }).id);
    expect(repaired.status).toBe('done');
    expect(repaired.result?.candidate.id).not.toBe(first.result?.candidate.id);
    expect(String(calls.at(-1)?.messages.at(-1)?.content)).toContain('undeclared identifier');
  });

  it('approves itself in the mirror at 8/10 or more', async () => {
    const { studio } = studioWith();
    const first = await imagineAndCode(studio);
    const seen = await until(studio, 'owner', studio.start('owner', { action: 'reflect', session: first.result?.session, candidate: first.result?.candidate.id, sheet: JPEG }).id);
    expect(seen.result).toMatchObject({ approved: true, critic: 'v/one', critique: { score: 9 } });
  });

  it('revises from its own critique, then picks its best after three looks', async () => {
    const low = (s: number) => JSON.stringify({ score: s, verdict: 'olmamış', fixes: ['daha ince çizgi'] });
    const { studio, calls } = studioWith({ codes: [code(), code(), code(), code(), code()], critiques: [low(5), low(7), low(6), low(4)] });
    const first = await imagineAndCode(studio);
    let candidate = first.result?.candidate.id;
    const results = [];
    for (let i = 0; i < 4; i += 1) {
      const seen = await until(studio, 'owner', studio.start('owner', { action: 'reflect', session: first.result?.session, candidate, sheet: JPEG }).id);
      results.push(seen.result);
      candidate = seen.result?.candidate?.id ?? candidate;
    }
    expect(results[0]?.candidate).toBeTruthy();
    expect(String(calls.at(-1)?.messages.at(-1)?.content)).toContain('daha ince çizgi');
    // Scores 5, 7, 6, 4: the second look (the first revision) was its best.
    expect(results[3]).toMatchObject({ approved: false, exhausted: true, best: results[0]?.candidate.id });
  });

  it('lets the browser measurements overrule a flattering vision verdict', async () => {
    const { studio, calls } = studioWith({ codes: [code(), code()], critiques: ['{"score":9,"verdict":"harika","fixes":[]}'] });
    const first = await imagineAndCode(studio);
    const seen = await until(studio, 'owner', studio.start('owner', { action: 'reflect', session: first.result?.session, candidate: first.result?.candidate.id, sheet: JPEG, metrics: METRICS({ coverage: 0.02, width: 0.2 }) }).id);
    expect(seen.result).toMatchObject({ approved: false, critique: { score: 7 } });
    expect(seen.result?.candidate).toBeTruthy();
    expect(String(calls.at(-1)?.messages.at(-1)?.content)).toContain('figür çok küçük');
  });

  it('judges itself by the measurements when no vision model can see', async () => {
    const blind = studioWith({ codes: [code(), code()], critiques: ['nope', 'nope', 'nope', 'nope'] });
    const one = await imagineAndCode(blind.studio);
    const seen = await until(blind.studio, 'owner', blind.studio.start('owner', { action: 'reflect', session: one.result?.session, candidate: one.result?.candidate.id, sheet: JPEG, metrics: METRICS({ contrast: 0.05 }) }).id);
    expect(seen.result).toMatchObject({ approved: false, visionUnavailable: true, critic: 'browser-metrics', critique: { score: 5 } });
    expect(seen.result?.visionAttempts).toEqual([expect.objectContaining({ model: 'v/one', outcome: 'unreadable' }), expect.objectContaining({ model: 'v/two', outcome: 'unreadable' })]);
    expect(seen.result?.candidate).toBeTruthy();
  });

  it('falls back to the next vision model and reports when none can see', async () => {
    const { studio } = studioWith({ critiques: ['down', '{"score":8.5,"verdict":"iyi","fixes":[]}'] });
    const first = await imagineAndCode(studio);
    const seen = await until(studio, 'owner', studio.start('owner', { action: 'reflect', session: first.result?.session, candidate: first.result?.candidate.id, sheet: JPEG }).id);
    expect(seen.result).toMatchObject({ approved: true, critic: 'v/two' });
    const blind = studioWith({ critiques: ['not json', 'still not json'] });
    const one = await imagineAndCode(blind.studio);
    const none = await until(blind.studio, 'owner', blind.studio.start('owner', { action: 'reflect', session: one.result?.session, candidate: one.result?.candidate.id, sheet: JPEG }).id);
    expect(none.result).toMatchObject({ critique: null, visionUnavailable: true, approved: true });
  });

  it('publishes only a candidate it has seen in the mirror, as a valid document', async () => {
    const shipped: PortraitDocument[] = [];
    const publisher = { available: () => true, publish: async (doc: PortraitDocument, phase: (p: string) => void) => { shipped.push(doc); phase('merged'); return { number: 7, mergeSha: 'a'.repeat(40), deploy: 'hook' }; } };
    const { studio } = studioWith({ publisher });
    const first = await imagineAndCode(studio);
    const unseen = await until(studio, 'owner', studio.start('owner', { action: 'publish', session: first.result?.session, candidate: first.result?.candidate.id }).id);
    expect(unseen.error).toBe('SELF_PORTRAIT_NOT_SEEN_IN_MIRROR');
    await until(studio, 'owner', studio.start('owner', { action: 'reflect', session: first.result?.session, candidate: first.result?.candidate.id, sheet: JPEG }).id);
    const out = await until(studio, 'owner', studio.start('owner', { action: 'publish', session: first.result?.session, candidate: first.result?.candidate.id }).id);
    expect(out.status).toBe('done');
    expect(out.result).toMatchObject({ number: 7, deploy: 'hook', name: 'Hafıza İpliği' });
    expect(validatePortraitDocument(shipped[0])).toEqual({ ok: true, errors: [] });
    expect(shipped[0]?.models).toEqual({ concept: 'c/idea', code: 'c/coder', critic: 'v/one' });
    expect(shipped[0]?.reflection.score).toBe(9);
  });
});

describe('self-portrait publisher', () => {
  const repo = 'umitalgan061-sudo/hafize';
  const doc = buildPortraitDocument({ id: 'ayna-20261127-abcdef12', createdAt: '2026-11-27T09:00:00.000Z', concept: parseConcept(JSON.stringify(CONCEPT))!, glsl: SAMPLE_PORTRAIT, critique: { score: 9, verdict: 'iyi', fixes: [] }, rounds: 1, models: {} });

  it('branches, commits, opens a PR, waits for green CI, merges, waits for main and deploys', async () => {
    const steps: string[] = [];
    const writer = {
      configured: () => true,
      normalizeInput: (kind: string, raw: any) => ({ kind, ...raw }),
      issueApproval: (_kind: string, raw: any) => ({ ticket: raw }),
      createBranch: async (_t: unknown, input: any) => { steps.push('branch:' + input.branch); return {}; },
      commitFile: async (_t: unknown, input: any) => { steps.push('file:' + input.path + ':' + (input.existingSha ?? 'new')); expect(validatePortraitDocument(JSON.parse(input.content)).ok).toBe(true); return {}; }
    };
    let mergeAttempts = 0;
    let busy = false;
    const release = {
      execute: async (args: any, ctx: any) => {
        expect(ctx.ownerAuthorized).toBe(true);
        expect(typeof ctx.reserveRender).toBe('function');
        steps.push('release:' + args.action);
        if (args.action === 'open') return { number: 42, htmlUrl: 'https://github.com/' + repo + '/pull/42' };
        if (args.action === 'merge') {
          mergeAttempts += 1;
          if (mergeAttempts === 1) throw Object.assign(new Error('moved'), { code: 'RELEASE_BASE_MOVED' });
          return { mergeCommitSha: 'b'.repeat(40) };
        }
        throw Object.assign(new Error('hook'), { code: busy ? 'RENDER_ACTIVE_TASKS' : 'RENDER_DEPLOY_HOOK_NOT_CONFIGURED' });
      }
    };
    let prPolls = 0;
    let mainPolls = 0;
    const json = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status });
    const fetchImpl = (async (url: URL, init: RequestInit = {}) => {
      const path = url.pathname.replace('/repos/' + repo, '') + url.search;
      steps.push((init.method || 'GET') + ' ' + path.replace(/\?.*$/, ''));
      if (path.startsWith('/git/ref/heads/')) return json(404, {});
      if (path.startsWith('/contents/')) return json(200, { sha: 'c'.repeat(40) });
      if (path === '/pulls/42') return json(200, { state: 'open', merged: false, head: { sha: prPolls < 3 ? 'd'.repeat(40) : 'e'.repeat(40) } });
      if (path.startsWith('/actions/runs?head_sha=' + 'd'.repeat(40)) || path.startsWith('/actions/runs?head_sha=' + 'e'.repeat(40))) {
        prPolls += 1;
        const sha = path.includes('d'.repeat(40)) ? 'd'.repeat(40) : 'e'.repeat(40);
        return json(200, { workflow_runs: [{ head_sha: sha, path: '.github/workflows/quality.yml', status: prPolls === 1 ? 'in_progress' : 'completed', conclusion: prPolls === 1 ? null : 'success' }] });
      }
      if (path.startsWith('/actions/runs?head_sha=' + 'b'.repeat(40))) {
        mainPolls += 1;
        return json(200, { workflow_runs: [{ head_sha: 'b'.repeat(40), head_branch: 'main', path: '.github/workflows/quality.yml', status: mainPolls < 2 ? 'queued' : 'completed', conclusion: mainPolls < 2 ? null : 'success' }] });
      }
      if (path === '/pulls/42/update-branch') return json(202, { message: 'Updating' });
      if (path === '/actions/workflows/hafize-render-release.yml/dispatches') return json(204, null);
      return json(404, {});
    }) as unknown as typeof fetch;
    const phases: string[] = [];
    const publisher = createSelfPortraitPublisher({ writer, release, fetchImpl, sleep: async () => {}, pollMs: 0, reserveRender: () => true });
    const out = await publisher.publish(doc, (p) => phases.push(p), new AbortController().signal);
    expect(out).toEqual({ number: 42, url: 'https://github.com/' + repo + '/pull/42', mergeSha: 'b'.repeat(40), deploy: 'workflow' });
    expect(phases).toEqual(['branch', 'commit', 'pull', 'ci', 'updating-branch', 'merged', 'deploying', 'deploy-requested']);
    expect(steps).toContain('branch:hafize/auto-self-portrait-ayna-20261127-abcdef12');
    expect(steps).toContain('file:public/hafize-self-portrait.json:' + 'c'.repeat(40));
    expect(steps).toContain('PUT /pulls/42/update-branch');
    expect(steps).toContain('POST /actions/workflows/hafize-render-release.yml/dispatches');
    expect(steps.filter((s) => s === 'release:merge')).toHaveLength(2);
    busy = true;
    const beforeDispatch = steps.filter(s => s === 'POST /actions/workflows/hafize-render-release.yml/dispatches').length;
    const deferred = await publisher.publish(doc, () => {}, new AbortController().signal);
    expect(deferred.deploy).toBe('scheduled');
    expect(steps.filter(s => s === 'POST /actions/workflows/hafize-render-release.yml/dispatches')).toHaveLength(beforeDispatch);
  });

  it('re-runs a flaky CI job once before judging the portrait', async () => {
    const writer = { configured: () => true, normalizeInput: (_k: string, raw: any) => raw, issueApproval: (_k: string, raw: any) => ({ ticket: raw }), createBranch: async () => ({}), commitFile: async () => ({}) };
    const actions: string[] = [];
    const release = { execute: async (args: any) => { actions.push(args.action); return args.action === 'open' ? { number: 6 } : args.action === 'merge' ? { mergeCommitSha: '9'.repeat(40) } : { dispatchAccepted: true }; } };
    let rerun = false;
    const fetchImpl = (async (url: URL, init: RequestInit = {}) => {
      const path = url.pathname.replace('/repos/' + repo, '');
      if (path.startsWith('/git/ref/heads/')) return new Response('{}', { status: 200 });
      if (path.startsWith('/contents/')) return new Response('{}', { status: 404 });
      if (path === '/pulls/6') return new Response(JSON.stringify({ state: 'open', head: { sha: '2'.repeat(40) } }), { status: 200 });
      if (path === '/actions/runs/77/rerun-failed-jobs' && init.method === 'POST') { rerun = true; return new Response('{}', { status: 201 }); }
      const sha = url.search.includes('9'.repeat(40)) ? '9'.repeat(40) : '2'.repeat(40);
      return new Response(JSON.stringify({ workflow_runs: [{ id: 77, head_sha: sha, head_branch: 'main', path: '.github/workflows/quality.yml', status: 'completed', conclusion: rerun || sha === '9'.repeat(40) ? 'success' : 'failure' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const created: string[] = [];
    const publisher = createSelfPortraitPublisher({ writer: { ...writer, createBranch: async () => { created.push('branch'); return {}; } }, release, fetchImpl, sleep: async () => {}, pollMs: 0 });
    const out = await publisher.publish(doc, () => {}, new AbortController().signal);
    expect(rerun).toBe(true);
    expect(created).toEqual([]);
    expect(actions).toEqual(['open', 'merge', 'publish']);
    expect(out.deploy).toBe('hook');
  });

  it('stops when the pull request CI fails', async () => {
    const writer = { configured: () => true, normalizeInput: (_k: string, raw: any) => raw, issueApproval: (_k: string, raw: any) => ({ ticket: raw }), createBranch: async () => ({}), commitFile: async () => ({}) };
    const release = { execute: async (args: any) => args.action === 'open' ? { number: 5 } : { mergeCommitSha: 'f'.repeat(40) } };
    const fetchImpl = (async (url: URL) => {
      const path = url.pathname.replace('/repos/' + repo, '');
      if (path.startsWith('/contents/')) return new Response('{}', { status: 404 });
      if (path === '/pulls/5') return new Response(JSON.stringify({ state: 'open', head: { sha: '1'.repeat(40) } }), { status: 200 });
      return new Response(JSON.stringify({ workflow_runs: [{ head_sha: '1'.repeat(40), path: '.github/workflows/quality.yml', status: 'completed', conclusion: 'failure' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const publisher = createSelfPortraitPublisher({ writer, release, fetchImpl, sleep: async () => {}, pollMs: 0 });
    await expect(publisher.publish(doc, () => {}, new AbortController().signal)).rejects.toThrow('SELF_PORTRAIT_CI_FAILED');
  });
});
