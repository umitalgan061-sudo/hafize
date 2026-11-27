import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SELF_PORTRAIT_PATH, buildPortraitDocument, objectiveIssues, parseMirrorMetrics, codeMessages, conceptMessages, extractPortraitCode, parseConcept, parseCritique,
  parseSheetDataUrl, portraitShaderSource, sanitizePortraitGlsl, validatePortraitDocument, validatePortraitGlsl
} from './self-portrait.ts';
import { releasePathAllowed } from './github-agent-release.ts';

const ROOT = join(import.meta.dirname, '..');

const SAMPLE_PORTRAIT = `
// Test fixture only: a simple ribbon, not Hafize's own design.
float ring(vec2 p, float r, float w) { return smoothstep(w + uPx * 1.5, w, abs(length(p) - r)); }
vec4 hafizePortrait(vec2 p) {
  float t = uFlow;
  float a = 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 q = p + 0.08 * vec2(sin(t + fi), cos(t * 0.7 + fi));
    float k = ring(q, 0.35 + 0.05 * fi + 0.04 * uVoice * uSpeak, 0.006);
    col += mix(vec3(1.0, 0.55, 0.3), vec3(0.6, 0.2, 0.1), uLight) * k;
    a = max(a, k);
  }
  return vec4(col, a);
}`;

const concept = {
  name: 'Hafıza İpliği',
  essence: 'Ben, söylenenleri ince bir iplik gibi saklayan bir hafızayım.',
  why: 'İplik süreklilik demek.',
  form: 'Boşlukta kendi etrafında dolanan ışıklı bir iplik.',
  palette: ['#f2a65a', '#7a2e1d'],
  states: { idle: 'yavaş', listening: 'açılır', thinking: 'düğümlenir', speaking: 'titreşir' }
};

describe('self-portrait GLSL contract', () => {
  it('accepts a valid portrait and the host wrapper uses it unchanged', () => {
    const check = validatePortraitGlsl(SAMPLE_PORTRAIT);
    expect(check.errors).toEqual([]);
    expect(check.ok).toBe(true);
    const source = portraitShaderSource(check.glsl);
    expect(source).toContain('#line 1\n' + check.glsl + '\nvoid main(){');
    expect(source).toContain('gl_FragColor=vec4(c.rgb*c.a,c.a);');
  });

  it('keeps the browser host wrapper identical to the contract', () => {
    const host = readFileSync(join(ROOT, 'public/home-voice-luminous-core.js'), 'utf8');
    for (const line of portraitShaderSource('X').split('\n').filter((l) => l !== 'X')) {
      expect(host).toContain("'" + line + "'");
    }
  });

  it.each([
    ['#define X 1\n', 'preprocessor'],
    ['uniform float uExtra;\n', 'uniforms'],
    ['precision highp float;\n', 'precision'],
    ['float f(){ float i=0.0; while(i<1.0){i+=1.0;} return i; }\n', 'for-loops'],
    ['vec4 g(){ return texture2D(s, vec2(0.0)); }\n', 'textures'],
    ['void main(){}\n', 'main'],
    ['float uTime = 1.0;\n', 'redeclare'],
    ['float h(){ float s=0.0; for(int i=0;i<200;i++){s+=1.0;} return s; }\n', 'at most 48'],
    ['float k(){ return fwidth(1.0); }\n', 'derivatives']
  ])('rejects %j', (prefix, message) => {
    const check = validatePortraitGlsl(prefix + SAMPLE_PORTRAIT);
    expect(check.ok).toBe(false);
    expect(check.errors.join(' | ')).toContain(message);
  });

  it('requires exactly one entry point and balanced code', () => {
    expect(validatePortraitGlsl('vec4 other(vec2 p){ return vec4(0.0); }'.padEnd(200, ' ')).errors.join()).toContain('exactly one');
    expect(validatePortraitGlsl(SAMPLE_PORTRAIT + '\n}').errors.join()).toContain('curly braces');
  });

  it('transliterates Turkish comments to the GLSL character set', () => {
    expect(sanitizePortraitGlsl('// ışık, gölge, ünlü çiçek ş ğ\nvec4 x;')).toBe('// isik, golge, unlu cicek s g\nvec4 x;');
    expect(sanitizePortraitGlsl('a—b')).toBe('ab');
  });
});

describe('self-portrait model replies', () => {
  it('extracts the glsl block and the Turkish note', () => {
    const reply = 'Here it is\n```glsl\n' + SAMPLE_PORTRAIT + '\n```\nNot: İplik konuşurken titreşir.';
    const out = extractPortraitCode(reply);
    expect(out?.glsl).toContain('hafizePortrait');
    expect(out?.note).toBe('İplik konuşurken titreşir.');
    expect(extractPortraitCode('no code')).toBeNull();
  });

  it('parses a concept and drops invalid colours', () => {
    const parsed = parseConcept('<think>...</think>```json\n' + JSON.stringify({ ...concept, palette: ['#F2A65A', 'red', '#123'] }) + '\n```');
    expect(parsed?.name).toBe('Hafıza İpliği');
    expect(parsed?.palette).toEqual(['#f2a65a']);
    expect(parseConcept('{"name":"x"}')).toBeNull();
  });

  it('parses a critique within 0..10', () => {
    expect(parseCritique('{"score": 7.5, "verdict": "iyi", "fixes": ["a", "b"]}')).toEqual({ score: 7.5, verdict: 'iyi', fixes: ['a', 'b'] });
    expect(parseCritique('{"score": 12}')).toBeNull();
    expect(parseCritique('{"score": "7/10", "verdict": "x"}')?.score).toBe(7);
    expect(parseCritique('{"score": "7,5", "verdict": "x"}')?.score).toBe(7.5);
  });

  it('briefs Hafize with the earlier looks to avoid and the code contract', () => {
    const brief = conceptMessages(null).map((m) => m.content).join('\n');
    expect(brief).toContain('aurora');
    expect(brief).toContain('Yalnız JSON');
    const code = codeMessages(parseConcept(JSON.stringify(concept))!, { glsl: 'x', compileLog: 'ERROR: 0:3: syntax error' });
    expect(code[0]?.content).toContain('vec4 hafizePortrait(vec2 p)');
    expect(code.at(-1)?.content).toContain('ERROR: 0:3');
  });
});

describe('mirror measurements', () => {
  const tile = (state: string, theme: string, coverage = 0.3, width = 0.7, height = 0.6, contrast = 0.4) => ({ state, theme, coverage, width, height, contrast });
  const all = (over: (s: string, t: string) => object = () => ({})) => ['dark', 'light'].flatMap((t) => ['idle', 'listening', 'thinking', 'speaking'].map((s) => ({ ...tile(s, t), ...over(s, t) })));

  it('accepts eight measured tiles and rejects anything else', () => {
    expect(parseMirrorMetrics({ tiles: all(), distinct: 0.05 })?.tiles).toHaveLength(8);
    expect(parseMirrorMetrics({ tiles: all().slice(1), distinct: 0.05 })).toBeNull();
    expect(parseMirrorMetrics({ tiles: all(() => ({ coverage: 3 })), distinct: 0.05 })).toBeNull();
  });

  it('turns small, faint, flooding or identical frames into concrete fixes', () => {
    expect(objectiveIssues(parseMirrorMetrics({ tiles: all(), distinct: 0.05 }))).toEqual([]);
    const tiny = objectiveIssues(parseMirrorMetrics({ tiles: all((s) => s === 'idle' ? { coverage: 0.02, width: 0.2 } : {}), distinct: 0.05 }));
    expect(tiny.join()).toContain('koyu temada figür çok küçük');
    expect(tiny.join()).toContain('boşta');
    expect(objectiveIssues(parseMirrorMetrics({ tiles: all((_s, t) => t === 'light' ? { contrast: 0.05 } : {}), distinct: 0.05 })).join()).toContain('daha koyu, doygun');
    expect(objectiveIssues(parseMirrorMetrics({ tiles: all(() => ({ coverage: 0.95 })), distinct: 0.05 })).join()).toContain('arka planı boyama');
    expect(objectiveIssues(parseMirrorMetrics({ tiles: all(), distinct: 0.001 })).join()).toContain('dört hâl');
  });
});

describe('self-portrait document', () => {
  it('builds and validates the committed data file shape', () => {
    const doc = buildPortraitDocument({
      id: 'ayna-20261127-abcdef12', createdAt: '2026-11-27T09:00:00.000Z', concept: parseConcept(JSON.stringify(concept))!,
      glsl: SAMPLE_PORTRAIT, critique: { score: 8, verdict: 'güzel', fixes: [] }, rounds: 1, models: { concept: 'a/b', code: 'c/d', critic: 'e/f' }
    });
    expect(validatePortraitDocument(doc)).toEqual({ ok: true, errors: [] });
    expect(validatePortraitDocument({ ...doc, extra: 1 }).ok).toBe(false);
    expect(validatePortraitDocument({ ...doc, glsl: 'uniform float x;' + doc.glsl }).ok).toBe(false);
  });

  it('only accepts real JPEG or PNG mirror sheets', () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100)]).toString('base64');
    expect(parseSheetDataUrl('data:image/jpeg;base64,' + jpeg)?.mime).toBe('image/jpeg');
    expect(parseSheetDataUrl('data:image/png;base64,' + jpeg)).toBeNull();
    expect(parseSheetDataUrl('data:text/html;base64,' + jpeg)).toBeNull();
  });

  it('lets the release tool merge only the portrait data file besides source scopes', () => {
    expect(releasePathAllowed('umitalgan061-sudo/hafize', SELF_PORTRAIT_PATH)).toBe(true);
    expect(releasePathAllowed('umitalgan061-sudo/hafize', 'public/other.json')).toBe(false);
  });

  // CI gate for Hafize's own pull requests: the published portrait must obey the contract.
  it('validates the published portrait when there is one', () => {
    const file = join(ROOT, SELF_PORTRAIT_PATH);
    if (!existsSync(file)) return;
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    expect(validatePortraitDocument(doc)).toEqual({ ok: true, errors: [] });
  });
});
