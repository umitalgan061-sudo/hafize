import {describe, it, expect, vi} from 'vitest';
import {
  aggregateJudgeVotes, createProjectVisionJudge, decodeJudgeImage, judgeOrders, parseJudgeModels,
  parseJudgeVote, VISION_JUDGE_DEFAULT_MODELS, VISION_JUDGE_LIMITS
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
    const judge = createProjectVisionJudge({complete, models: ['nvidia/nemotron-judge-vl', 'meta/judge-vision']});
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
  const jury=createProjectVisionJudge({models:['nvidia/a','meta/b'],complete:async(payload)=>{
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
