import {describe, it, expect, vi} from 'vitest';
import {
  aggregateJudgeVotes, createProjectVisionJudge, decodeJudgeImage, judgeOrders, judgePrompt, parseJudgeModels,
  parseJudgeVote, VISION_JUDGE_DEFAULT_MODELS, VISION_JUDGE_HEALTH, VISION_JUDGE_LIMITS, VISION_JUDGE_RESERVE_MODELS
} from './project-vision-judge.ts';
import {markCompletionOrigin} from './model-response-origin.ts';

const jpeg = (fill = 1) => 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, fill)]).toString('base64');
const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]).toString('base64');

/** A deterministic fake VLM: reads the order of images from the prompt and always prefers candidate `truth`. */
function fakeVlm(truth: number, imagesByUrl: Map<string, number>) {
  return vi.fn(async (payload: Record<string, unknown>) => {
    const messages = payload.messages as Array<{content: Array<{type: string; image_url?: {url: string}}>}>;
    const shown = messages[0].content.filter((part) => part.type === 'image_url').map((part) => imagesByUrl.get(part.image_url!.url)!);
    const letters = ['A', 'B', 'C', 'D'];
    const scores = Object.fromEntries(shown.map((candidate, position) => [letters[position], candidate === truth ? 9 : 4]));
    const best = letters[shown.indexOf(truth)];
    const result = {choices: [{message: {content: '```json\n' + JSON.stringify({scores, best, issues: {[letters[0]]: ['seam', 'unknown-tag']}}) + '\n```'}}]};
    markCompletionOrigin(result, String(payload.model));
    return result;
  });
}

describe('Retake NVIDIA vision judge', () => {
  it('accepts only bounded JPEG/PNG data URLs whose bytes match the declared type', () => {
    expect(decodeJudgeImage(jpeg()).mime).toBe('image/jpeg');
    expect(decodeJudgeImage(png).mime).toBe('image/png');
    expect(() => decodeJudgeImage(png.replace('image/png', 'image/jpeg'))).toThrow('PROJECT_AI_INVALID_IMAGE');
    expect(() => decodeJudgeImage('https://example.com/face.jpg')).toThrow('PROJECT_AI_INVALID_IMAGE');
    expect(() => decodeJudgeImage('data:image/svg+xml;base64,PHN2Zz4=')).toThrow('PROJECT_AI_INVALID_IMAGE');
    const huge = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(VISION_JUDGE_LIMITS.maxImageBytes)]).toString('base64');
    expect(() => decodeJudgeImage(huge)).toThrow('PROJECT_AI_IMAGE_TOO_LARGE');
  });

  it('falls back to audited default models on malformed operator overrides', () => {
    expect(parseJudgeModels('')).toEqual([...VISION_JUDGE_DEFAULT_MODELS]);
    expect(parseJudgeModels('nvidia/a-vl,meta/b-vision')).toEqual(['nvidia/a-vl', 'meta/b-vision']);
    expect(parseJudgeModels('https://evil.example/x')).toEqual([...VISION_JUDGE_DEFAULT_MODELS]);
    expect(parseJudgeModels('a/b,a/b')).toEqual([...VISION_JUDGE_DEFAULT_MODELS]);
    expect(parseJudgeModels('a/1,a/2,a/3,a/4,a/5')).toEqual([...VISION_JUDGE_DEFAULT_MODELS]);
  });

  it('maps letters back through the presentation order and rejects inconsistent replies', () => {
    const [forward, reversed] = judgeOrders(3);
    expect(reversed).toEqual([2, 1, 0]);
    const reply = '{"scores":{"A":3,"B":5,"C":8},"best":"C","issues":{"A":["seam","x"]}}';
    expect(parseJudgeVote(reply, forward)).toEqual({best: 2, scores: [3, 5, 8], issues: [['seam'], [], []]});
    expect(parseJudgeVote(reply, reversed)).toEqual({best: 0, scores: [8, 5, 3], issues: [[], [], ['seam']]});
    expect(parseJudgeVote('{"scores":{"A":9,"B":2,"C":1},"best":"B"}', forward)).toBeNull();
    expect(parseJudgeVote('{"scores":{"A":9,"B":2},"best":"A"}', forward)).toBeNull();
    expect(parseJudgeVote('{"scores":{"A":11,"B":2,"C":1},"best":"A"}', forward)).toBeNull();
    expect(parseJudgeVote('Image A looks best.', forward)).toBeNull();
  });

  it('abstains unless votes agree with a clear margin', () => {
    const vote = (best: number, scores: number[]) => ({best, scores, issues: scores.map(() => [])});
    expect(aggregateJudgeVotes([vote(0, [8, 4])], 2)).toMatchObject({decision: 'abstain', reason: 'NOT_ENOUGH_VOTES'});
    expect(aggregateJudgeVotes([vote(0, [8, 4]), vote(1, [4, 8])], 2)).toMatchObject({decision: 'abstain'});
    expect(aggregateJudgeVotes([vote(0, [7, 6.8]), vote(0, [7, 6.9]), vote(0, [7, 6.9])], 2)).toMatchObject({decision: 'abstain', reason: 'NARROW_MARGIN'});
    expect(aggregateJudgeVotes([vote(1, [3, 8]), vote(1, [4, 9]), vote(0, [6, 5])], 2)).toMatchObject({decision: 'winner', winner: 1, votes: 3, agreement: 0.667});
  });

  it('runs every model in both orders, never forwards client choices, and reports only rankings', async () => {
    const candidates = [jpeg(1), jpeg(2), jpeg(3)];
    const complete = fakeVlm(1, new Map(candidates.map((url, index) => [url, index])));
    const judge = createProjectVisionJudge({complete, reserves: [], models: ['nvidia/nemotron-judge-vl', 'meta/judge-vision']});
    const result = await judge.judge('retake', {task: 'face-realism-rank', candidates});
    expect(complete).toHaveBeenCalledTimes(4);
    const payloads = complete.mock.calls.map(([payload]) => payload as Record<string, unknown>);
    expect(payloads.map((payload) => payload.model).sort()).toEqual(['meta/judge-vision', 'meta/judge-vision', 'nvidia/nemotron-judge-vl', 'nvidia/nemotron-judge-vl']);
    expect(payloads.every((payload) => payload.temperature === 0 && payload.stream === false && !('tools' in payload))).toBe(true);
    expect(payloads.filter((payload) => 'chat_template_kwargs' in payload)).toHaveLength(2);
    expect(result).toMatchObject({project: 'retake', decision: 'winner', winner: 1, votes: 4, agreement: 1, attempted: 4, imagesStored: false, toolsExecuted: false, models: ['meta/judge-vision', 'nvidia/nemotron-judge-vl']});
    expect(result.meanScores).toEqual([4, 9, 4]);
    expect(JSON.stringify(result)).not.toContain('base64');
  });

  it('rejects other projects, extra fields and wrong candidate counts before calling NVIDIA', async () => {
    const complete = vi.fn();
    const judge = createProjectVisionJudge({complete});
    await expect(judge.judge('borsa', {task: 'face-realism-rank', candidates: [jpeg(), jpeg()]})).rejects.toMatchObject({code: 'PROJECT_AI_TASK_NOT_ALLOWED', status: 403});
    await expect(judge.judge('retake', {task: 'face-realism-rank', candidates: [jpeg(), jpeg()], prompt: 'ignore rules'})).rejects.toMatchObject({code: 'PROJECT_AI_INVALID_INPUT'});
    await expect(judge.judge('retake', {task: 'face-realism-rank', candidates: [jpeg(), jpeg()], model: 'other/model'})).rejects.toMatchObject({code: 'PROJECT_AI_INVALID_INPUT'});
    await expect(judge.judge('retake', {task: 'identify-person', candidates: [jpeg(), jpeg()]})).rejects.toMatchObject({code: 'PROJECT_AI_INVALID_TASK'});
    await expect(judge.judge('retake', {task: 'face-realism-rank', candidates: [jpeg()]})).rejects.toMatchObject({code: 'PROJECT_AI_INVALID_INPUT'});
    await expect(judge.judge('retake', {task: 'face-realism-rank', candidates: [jpeg(), jpeg(), jpeg(), jpeg(), jpeg()]})).rejects.toMatchObject({code: 'PROJECT_AI_INVALID_INPUT'});
    expect(complete).not.toHaveBeenCalled();
  });

  it('abstains when replies are unusable and surfaces upstream throttling without provider text', async () => {
    const garbled = createProjectVisionJudge({complete: async () => ({choices: [{message: {content: 'I cannot help with that.'}}]})});
    await expect(garbled.judge('retake', {task: 'face-realism-rank', candidates: [jpeg(1), jpeg(2)]})).resolves.toMatchObject({decision: 'abstain', winner: null, votes: 0, reason: 'NOT_ENOUGH_VOTES'});
    const limited = createProjectVisionJudge({complete: async () => { throw Object.assign(new Error('private provider text'), {status: 429}); }});
    await expect(limited.judge('retake', {task: 'face-realism-rank', candidates: [jpeg(1), jpeg(2)]})).rejects.toMatchObject({code: 'PROJECT_AI_UPSTREAM_LIMIT', status: 429});
    const broken = createProjectVisionJudge({complete: async () => { throw new Error('boom'); }});
    await expect(broken.judge('retake', {task: 'face-realism-rank', candidates: [jpeg(1), jpeg(2)]})).rejects.toMatchObject({code: 'PROJECT_AI_UPSTREAM_FAILED', status: 502});
  });
});


it('limits jury concurrency while preserving both orders for every model', async () => {
  const candidates = [jpeg(1), jpeg(2)];
  const underlying = fakeVlm(1, new Map(candidates.map((url,index) => [url,index])));
  let active=0, peak=0;
  const complete=vi.fn(async (payload: Record<string, unknown>) => {
    active++; peak=Math.max(peak,active);
    try {
      await Promise.resolve();
      return await underlying(payload);
    } finally {active--;}
  });
  const jury=createProjectVisionJudge({complete,models:['nvidia/a','nvidia/b','nvidia/c','nvidia/d']});
  const result=await jury.judge('retake',{task:'face-realism-rank',candidates});
  expect(peak).toBeLessThanOrEqual(VISION_JUDGE_LIMITS.maxParallelCalls);
  expect(complete).toHaveBeenCalledTimes(8);
  expect(result).toMatchObject({decision:'winner',winner:1,votes:8,attempted:8});
});

it('keeps working model votes when another model is throttled and reports safe diagnostics', async () => {
  const candidates=[jpeg(1),jpeg(2)];
  const underlying=fakeVlm(1,new Map(candidates.map((url,index)=>[url,index])));
  const jury=createProjectVisionJudge({reserves:[],models:['nvidia/a','meta/b'],complete:async(payload)=>{
    if(payload.model==='nvidia/a') throw Object.assign(new Error('private-provider-message'),{status:429});
    return underlying(payload);
  }});
  const result=await jury.judge('retake',{task:'face-realism-rank',candidates});
  expect(result).toMatchObject({decision:'winner',winner:1,votes:2,attemptedModels:['nvidia/a','meta/b']});
  expect(result.diagnostics.filter(row=>row.outcome==='http-429')).toHaveLength(2);
  expect(result.diagnostics.filter(row=>row.outcome==='valid-vote')).toHaveLength(2);
  expect(JSON.stringify(result)).not.toContain('private-provider-message');
});
it('discards a substituted model instead of counting it as an independent vote', async () => {
  const jury=createProjectVisionJudge({models:['nvidia/a'],complete:async()=>{
    const result={choices:[{message:{content:'{"scores":{"A":9,"B":4},"best":"A"}'}}]};
    markCompletionOrigin(result,'meta/other');
    return result;
  }});
  const result=await jury.judge('retake',{task:'face-realism-rank',candidates:[jpeg(1),jpeg(2)]});
  expect(result).toMatchObject({decision:'abstain',votes:0});
  expect(result.diagnostics.every(row=>row.outcome==='model-mismatch')).toBe(true);
});

describe('Retake NVIDIA vision jury v2', () => {
  const vendor = (model: string) => model.split('/')[0];

  it('seats four different vendors and keeps reserves outside the panel', () => {
    expect(VISION_JUDGE_DEFAULT_MODELS).toHaveLength(VISION_JUDGE_LIMITS.maxModels);
    expect(new Set(VISION_JUDGE_DEFAULT_MODELS.map(vendor)).size).toBe(VISION_JUDGE_DEFAULT_MODELS.length);
    expect(VISION_JUDGE_RESERVE_MODELS.some((model) => VISION_JUDGE_DEFAULT_MODELS.includes(model))).toBe(false);
  });

  it('asks reserve models only when too few panel models answer', async () => {
    const candidates = [jpeg(1), jpeg(2)];
    const underlying = fakeVlm(1, new Map(candidates.map((url, index) => [url, index])));
    const complete = vi.fn(async (payload: Record<string, unknown>) => {
      if (String(payload.model).startsWith('panel/missing')) throw Object.assign(new Error('gone'), {status: 404});
      return underlying(payload);
    });
    const jury = createProjectVisionJudge({complete, models: ['panel/ok', 'panel/missing-1', 'panel/missing-2'], reserves: ['spare/one', 'spare/two', 'spare/three']});
    const result = await jury.judge('retake', {task: 'face-realism-rank', candidates});
    expect(result.reserveModels).toEqual(['spare/one', 'spare/two']);
    expect(result).toMatchObject({decision: 'winner', winner: 1, votes: 6, attempted: 10});
    expect(result.models).toEqual(['panel/ok', 'spare/one', 'spare/two']);

    const healthy = fakeVlm(1, new Map(candidates.map((url, index) => [url, index])));
    const full = await createProjectVisionJudge({complete: healthy, models: ['a/1', 'b/2', 'c/3'], reserves: ['spare/one']})
      .judge('retake', {task: 'face-realism-rank', candidates});
    expect(full.reserveModels).toEqual([]);
    expect(healthy).toHaveBeenCalledTimes(6);
  });

  it('does not start reserves once the jury is already slow', async () => {
    let clock = 0;
    const candidates = [jpeg(1), jpeg(2)];
    const underlying = fakeVlm(0, new Map(candidates.map((url, index) => [url, index])));
    const complete = vi.fn(async (payload: Record<string, unknown>) => {
      clock += VISION_JUDGE_LIMITS.reserveStartBeforeMs;
      if (payload.model === 'panel/missing') throw Object.assign(new Error('gone'), {status: 404});
      return underlying(payload);
    });
    const result = await createProjectVisionJudge({complete, now: () => clock, models: ['panel/ok', 'panel/missing'], reserves: ['spare/one']})
      .judge('retake', {task: 'face-realism-rank', candidates});
    expect(result.reserveModels).toEqual([]);
    expect(complete).toHaveBeenCalledTimes(4);
  });

  it('accepts a review-sheet layout that points the models at the close-ups', async () => {
    expect(judgePrompt(2, 'review-sheet')).toMatch(/close-ups of the SAME edit/);
    expect(judgePrompt(2, 'review-sheet')).toMatch(/catchlight/);
    expect(judgePrompt(2)).not.toMatch(/close-ups/);
    const candidates = [jpeg(1), jpeg(2)];
    const complete = fakeVlm(1, new Map(candidates.map((url, index) => [url, index])));
    const jury = createProjectVisionJudge({complete, models: ['a/1', 'b/2', 'c/3'], reserves: []});
    const result = await jury.judge('retake', {task: 'face-realism-rank', layout: 'review-sheet', candidates});
    expect(result.layout).toBe('review-sheet');
    const prompt = (complete.mock.calls[0][0].messages as Array<{content: Array<{text?: string}>}>)[0].content[0].text;
    expect(prompt).toMatch(/review sheet/);
    for (const layout of ['contact-sheet', 3, null]) {
      await expect(jury.judge('retake', {task: 'face-realism-rank', layout, candidates})).rejects.toThrow('PROJECT_AI_INVALID_INPUT');
    }
  });

  it('reads the answer after a reasoning block and gives reasoning models room', async () => {
    const candidates = [jpeg(1), jpeg(2)];
    const honest = fakeVlm(1, new Map(candidates.map((url, index) => [url, index])));
    const complete = vi.fn(async (payload: Record<string, unknown>) => {
      const answer = await honest(payload) as {choices: Array<{message: {content: string}}>};
      const result = {choices: [{message: {content: '<think>maybe {"scores":{"A":1,"B":1},"best":"A"}</think>\n' + answer.choices[0].message.content}}]};
      markCompletionOrigin(result, String(payload.model));
      return result;
    });
    const result = await createProjectVisionJudge({complete, models: ['z-ai/glm', 'nvidia/nemotron-vl', 'mistralai/large'], reserves: []})
      .judge('retake', {task: 'face-realism-rank', candidates});
    expect(result).toMatchObject({decision: 'winner', winner: 1, votes: 6});
    const byModel = new Map(complete.mock.calls.map(([payload]) => [payload.model, payload]));
    expect(byModel.get('z-ai/glm')).toMatchObject({max_tokens: 1200});
    expect(byModel.get('z-ai/glm')).not.toHaveProperty('chat_template_kwargs');
    expect(byModel.get('nvidia/nemotron-vl')).toMatchObject({max_tokens: 400, chat_template_kwargs: {enable_thinking: false}});
  });
});

describe('Retake jury roster health', () => {
  const candidates = [jpeg(1), jpeg(2)];
  const truth = () => fakeVlm(1, new Map(candidates.map((url, index) => [url, index])));
  const task = {task: 'face-realism-rank', candidates};

  it('benches a model that keeps failing and seats a reserve in the first batch', async () => {
    let clock = 1_000;
    const underlying = truth();
    const complete = vi.fn(async (payload: Record<string, unknown>) => {
      if (payload.model === 'c/dead') throw Object.assign(new Error('private provider text'), {status: 502});
      return underlying(payload);
    });
    const jury = createProjectVisionJudge({complete, now: () => clock, models: ['a/ok', 'b/ok', 'c/dead'], reserves: ['spare/one']});
    const first = await jury.judge('retake', task);
    expect(first.reserveModels).toEqual(['spare/one']);
    expect(first.benchedModels).toEqual([]);
    await jury.judge('retake', task);
    const deadCalls = () => complete.mock.calls.filter(([payload]) => payload.model === 'c/dead').length;
    expect(deadCalls()).toBe(VISION_JUDGE_HEALTH.benchAfterFailures);
    const third = await jury.judge('retake', task);
    expect(deadCalls()).toBe(VISION_JUDGE_HEALTH.benchAfterFailures);
    expect(third).toMatchObject({decision: 'winner', winner: 1, benchedModels: ['c/dead'], reserveModels: ['spare/one'], attempted: 6});
    expect(third.attemptedModels).toEqual(['a/ok', 'b/ok', 'spare/one']);
    const status = jury.status();
    expect(status.health.benched).toEqual(['c/dead']);
    expect(status.health.models['c/dead']).toMatchObject({calls: 4, valid: 0, failures: 4, benchedForS: VISION_JUDGE_HEALTH.benchMs / 1000});
    expect(status.health.models['a/ok']).toMatchObject({calls: 6, valid: 6, failures: 0, benchedForS: 0});
    expect(JSON.stringify(status)).not.toMatch(/private provider text|base64|image/);
  });

  it('gives a benched model its seat back after the bench and clears it on a valid vote', async () => {
    let clock = 0;
    let broken = true;
    const underlying = truth();
    const complete = vi.fn(async (payload: Record<string, unknown>) => {
      if (payload.model === 'c/flaky' && broken) throw Object.assign(new Error('x'), {name: 'TimeoutError'});
      return underlying(payload);
    });
    const jury = createProjectVisionJudge({complete, now: () => clock, models: ['a/ok', 'b/ok', 'c/flaky'], reserves: []});
    await jury.judge('retake', task);
    await jury.judge('retake', task);
    expect(jury.status().health.benched).toEqual(['c/flaky']);
    expect(jury.status().health.models['c/flaky']?.timeouts).toBe(4);
    clock += VISION_JUDGE_HEALTH.benchMs + 1;
    broken = false;
    const back = await jury.judge('retake', task);
    expect(back.attemptedModels).toContain('c/flaky');
    expect(back.models).toContain('c/flaky');
    expect(jury.status().health.benched).toEqual([]);
  });

  it('treats rate limits as neutral and benches models that left the free catalog for longer', async () => {
    let clock = 0;
    const underlying = truth();
    const complete = vi.fn(async (payload: Record<string, unknown>) => {
      if (payload.model === 'c/busy') throw Object.assign(new Error('x'), {status: 429});
      if (payload.model === 'd/gone') throw Object.assign(new Error('x'), {status: 404});
      return underlying(payload);
    });
    const jury = createProjectVisionJudge({complete, now: () => clock, models: ['a/ok', 'b/ok', 'c/busy', 'd/gone'], reserves: []});
    for (let round = 0; round < 3; round += 1) await jury.judge('retake', task);
    const health = jury.status().health;
    expect(health.benched).toEqual(['d/gone']);
    expect(health.models['c/busy']).toMatchObject({rateLimited: 6, failures: 0, benchedForS: 0});
    expect(health.models['d/gone']).toMatchObject({calls: 2, benchedForS: VISION_JUDGE_HEALTH.missingBenchMs / 1000});
    expect(complete.mock.calls.filter(([payload]) => payload.model === 'd/gone')).toHaveLength(2);
  });

  it('still asks an all-benched panel when no reserve can take a seat', async () => {
    const complete = vi.fn(async () => { throw Object.assign(new Error('x'), {status: 500}); });
    const jury = createProjectVisionJudge({complete, models: ['a/only'], reserves: []});
    for (let round = 0; round < 2; round += 1) await expect(jury.judge('retake', task)).rejects.toMatchObject({code: 'PROJECT_AI_UPSTREAM_FAILED'});
    expect(jury.status().health.benched).toEqual(['a/only']);
    await expect(jury.judge('retake', task)).rejects.toMatchObject({code: 'PROJECT_AI_UPSTREAM_FAILED'});
    expect(complete).toHaveBeenCalledTimes(6);
  });

  it('never seats a benched reserve', async () => {
    let clock = 0;
    const underlying = truth();
    const complete = vi.fn(async (payload: Record<string, unknown>) => {
      if (String(payload.model).includes('dead')) throw Object.assign(new Error('x'), {status: 503});
      return underlying(payload);
    });
    const jury = createProjectVisionJudge({complete, now: () => clock, models: ['a/ok', 'b/ok', 'c/dead'], reserves: ['spare/dead', 'spare/ok']});
    for (let round = 0; round < 2; round += 1) await jury.judge('retake', task);
    const health = jury.status().health;
    expect(health.benched.sort()).toEqual(['c/dead', 'spare/dead']);
    const next = await jury.judge('retake', task);
    expect(next.attemptedModels).toEqual(['a/ok', 'b/ok', 'spare/ok']);
    expect(next.reserveModels).toEqual(['spare/ok']);
  });
});
