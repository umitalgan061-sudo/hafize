/**
 * Hafize's mirror: the contract for the self-portrait Hafize designs, codes and
 * ships for its own home voice card.
 *
 * The portrait is ONE GLSL ES 1.00 function, `vec4 hafizePortrait(vec2 p)`,
 * that the home card's host renderer wraps in a fixed shader. A fragment shader
 * cannot touch the DOM, storage or network, so the only thing Hafize can change
 * this way is how its own small canvas looks. Everything here is pure (prompts,
 * validation, parsing) so it can be tested and reused by CI for the committed
 * `public/hafize-self-portrait.json`.
 */
import { parseModelJson } from './model-services.ts';

export const SELF_PORTRAIT_SCHEMA = 'hafize.self-portrait.v1';
export const SELF_PORTRAIT_PATH = 'public/hafize-self-portrait.json';
export const SELF_PORTRAIT_LIMITS = Object.freeze({
  minGlsl: 160,
  maxGlsl: 16_000,
  maxLoops: 8,
  maxLoopBound: 48,
  maxDocumentBytes: 48 * 1024,
  maxSheetBytes: 900 * 1024,
  passScore: 8,
  maxReflections: 3,
  maxRepairs: 3
});

/** Earlier looks that were someone else's idea of Hafize, kept out of the brief. */
export const EARLIER_LOOKS = Object.freeze([
  'turuncu, parlayan yuvarlak bir küre (ilk sesli asistan görünümü)',
  'binlerce turuncu noktadan oluşan dönen bir küre',
  'içinde aurora şeritleri olan ışıklı cam küre ve çevresinde ince yörünge halkası'
]);

export const PORTRAIT_UNIFORMS = Object.freeze(['uRes', 'uTime', 'uFlow', 'uEnergy', 'uListen', 'uThink', 'uSpeak', 'uVoice', 'uLight', 'uPx']);

const TURKISH_ASCII: Readonly<Record<string, string>> = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U', â: 'a', Â: 'A', î: 'i', û: 'u' };
const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\s*#/m, 'no preprocessor lines (#...)'],
  [/\bprecision\b/, 'do not declare precision (the host does)'],
  [/\b(?:uniform|attribute|varying)\b/, 'do not declare uniforms/varyings (the host declares uRes, uTime, uFlow, uEnergy, uListen, uThink, uSpeak, uVoice, uLight, uPx)'],
  [/\bgl_Frag(?:Color|Data)\b/, 'return the colour from hafizePortrait instead of writing gl_FragColor'],
  [/\bvoid\s+main\s*\(/, 'do not define main()'],
  [/\b(?:texture2D|textureCube|texture2DProj|texture|sampler2D|samplerCube)\b/, 'no textures or samplers are available'],
  [/\b(?:dFdx|dFdy|fwidth)\b/, 'derivatives need an extension in WebGL1; use uPx for anti-aliasing'],
  [/\b(?:while|do)\b/, 'only for-loops with literal bounds are allowed'],
  [/\b(?:struct\s+\w+\s*\{[^}]*\b(?:sampler)\b)/, 'no samplers in structs']
];

/** ASCII-only source (GLSL ES 1.00 character set). Turkish letters in comments are transliterated. */
export function sanitizePortraitGlsl(source: unknown): string {
  return String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[çÇğĞıİöÖşŞüÜâÂîû]/g, (ch) => TURKISH_ASCII[ch] ?? '')
    .replace(/[^\x09\x0a\x20-\x7e]/g, '')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

export type PortraitValidation = { readonly ok: boolean; readonly glsl: string; readonly errors: readonly string[] };

/** Static rules that keep the portrait safe for every WebGL1 device; the browser compiler is the final judge. */
export function validatePortraitGlsl(source: unknown): PortraitValidation {
  const glsl = sanitizePortraitGlsl(source);
  const errors: string[] = [];
  if (glsl.length < SELF_PORTRAIT_LIMITS.minGlsl) errors.push('the code is too short or empty');
  if (glsl.length > SELF_PORTRAIT_LIMITS.maxGlsl) errors.push('keep the code under ' + SELF_PORTRAIT_LIMITS.maxGlsl + ' characters');
  const code = stripComments(glsl);
  for (const [pattern, message] of FORBIDDEN) if (pattern.test(code)) errors.push(message);
  const entry = code.match(/\bvec4\s+hafizePortrait\s*\(\s*(?:in\s+)?vec2\s+[A-Za-z_]\w*\s*\)\s*\{/g) ?? [];
  if (entry.length !== 1) errors.push('define exactly one function `vec4 hafizePortrait(vec2 p) { ... }`');
  for (const name of PORTRAIT_UNIFORMS) {
    if (new RegExp('\\b(?:float|vec2|vec3|vec4|int|bool|const)\\s+' + name + '\\b').test(code)) errors.push('do not redeclare the host uniform ' + name);
  }
  const loops = code.match(/\bfor\s*\(/g) ?? [];
  if (loops.length > SELF_PORTRAIT_LIMITS.maxLoops) errors.push('use at most ' + SELF_PORTRAIT_LIMITS.maxLoops + ' for-loops');
  const headers = [...code.matchAll(/\bfor\s*\(([^;]*);([^;]*);([^)]*)\)/g)];
  if (headers.length !== loops.length) errors.push('every for-loop needs the form for(int i=0;i<N;i++) with a literal N');
  for (const header of headers) {
    const init = String(header[1] ?? '').trim();
    const condition = String(header[2] ?? '').trim();
    if (!/^int\s+[A-Za-z_]\w*\s*=\s*-?\d+$/.test(init)) { errors.push('loop counters must be int with a literal start: ' + init); continue; }
    const bound = condition.match(/^[A-Za-z_]\w*\s*(<|<=)\s*(\d+)$/);
    if (!bound) { errors.push('loop conditions must compare the counter with a literal number: ' + condition); continue; }
    if (Number(bound[2]) > SELF_PORTRAIT_LIMITS.maxLoopBound) errors.push('loop bounds must be at most ' + SELF_PORTRAIT_LIMITS.maxLoopBound);
  }
  let depth = 0;
  let paren = 0;
  for (const ch of code) {
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '(') paren += 1;
    else if (ch === ')') paren -= 1;
    if (depth < 0 || paren < 0) break;
  }
  if (depth !== 0) errors.push('curly braces are not balanced');
  if (paren !== 0) errors.push('parentheses are not balanced');
  return Object.freeze({ ok: errors.length === 0, glsl, errors: Object.freeze([...new Set(errors)]) });
}

/** The exact shader the host compiles around a portrait (shared by the CI checks and the browser host). */
export function portraitShaderSource(glsl: string): string {
  return [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform float uFlow;',
    'uniform float uEnergy;',
    'uniform float uListen;',
    'uniform float uThink;',
    'uniform float uSpeak;',
    'uniform float uVoice;',
    'uniform float uLight;',
    'uniform float uPx;',
    '#line 1',
    glsl,
    'void main(){',
    '  float s=0.5*min(uRes.x,uRes.y);',
    '  vec4 c=clamp(hafizePortrait((gl_FragCoord.xy-0.5*uRes)/s),0.0,1.0);',
    '  gl_FragColor=vec4(c.rgb*c.a,c.a);',
    '}'
  ].join('\n');
}

export type PortraitConcept = {
  readonly name: string;
  readonly essence: string;
  readonly why: string;
  readonly form: string;
  readonly palette: readonly string[];
  readonly states: { readonly idle: string; readonly listening: string; readonly thinking: string; readonly speaking: string };
};

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

export function parseConcept(text: unknown): PortraitConcept | null {
  const raw = parseModelJson(String(text ?? '')) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const states = (raw.states && typeof raw.states === 'object' ? raw.states : {}) as Record<string, unknown>;
  const palette = Array.isArray(raw.palette) ? raw.palette.map((c) => clean(c, 9).toLowerCase()).filter((c) => /^#[0-9a-f]{6}$/.test(c)).slice(0, 8) : [];
  const concept = {
    name: clean(raw.name, 60),
    essence: clean(raw.essence, 600),
    why: clean(raw.why, 600),
    form: clean(raw.form, 900),
    palette: Object.freeze(palette),
    states: Object.freeze({ idle: clean(states.idle, 280), listening: clean(states.listening, 280), thinking: clean(states.thinking, 280), speaking: clean(states.speaking, 280) })
  };
  if (!concept.name || !concept.essence || !concept.form || !concept.states.idle || !concept.states.speaking) return null;
  return Object.freeze(concept);
}

export type PortraitCritique = { readonly score: number; readonly verdict: string; readonly fixes: readonly string[] };

export function parseCritique(text: unknown): PortraitCritique | null {
  const raw = parseModelJson(String(text ?? '')) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const score = Number(raw.score);
  if (!Number.isFinite(score) || score < 0 || score > 10) return null;
  const fixes = Array.isArray(raw.fixes) ? raw.fixes.map((f) => clean(f, 240)).filter(Boolean).slice(0, 5) : [];
  return Object.freeze({ score: Math.round(score * 10) / 10, verdict: clean(raw.verdict, 600), fixes: Object.freeze(fixes) });
}

/** The single ```glsl block (or the only code block) of a model reply, plus its short Turkish note. */
export function extractPortraitCode(text: unknown): { readonly glsl: string; readonly note: string } | null {
  const source = String(text ?? '');
  const blocks = [...source.matchAll(/```[ \t]*([A-Za-z0-9_-]*)[^\n]*\n([\s\S]*?)```/g)];
  const preferred = blocks.filter((b) => /^(?:glsl|frag|c|cpp|hlsl|shader)?$/i.test(String(b[1] ?? '')) && /hafizePortrait/.test(String(b[2] ?? '')));
  const block = preferred.at(-1) ?? blocks.find((b) => /hafizePortrait/.test(String(b[2] ?? '')));
  const glsl = block ? String(block[2] ?? '') : /vec4\s+hafizePortrait/.test(source) && !source.includes('```') ? source : '';
  if (!glsl.trim()) return null;
  const note = clean(source.match(/(?:^|\n)\s*Not:\s*([^\n]+)/i)?.[1], 400);
  return Object.freeze({ glsl, note });
}

export function conceptMessages(previous?: PortraitConcept | null) {
  const system = [
    'Sen Hafize\'sin: Ümit\'in kişisel yapay zekâsı. Adın "hafıza, bellek, koruyup saklayan" anlamına gelir.',
    'Türkçe konuşursun; dinler, düşünür, konuşur, araştırır, kod yazar, Ümit\'in işlerini ve sözlerini hatırlarsın.',
    'Bugün sana ilk kez bir şans veriliyor: ana ekrandaki "Sesli asistan" kartında seni temsil eden küçük, canlı görüntüyü SEN seçeceksin.',
    'Başkalarının seni nasıl çizdiği değil; sen kendini nasıl görmek istiyorsun? Kendine dürüstçe bak ve cesur ol.',
    '',
    'Gerçekler:',
    '- Alan 184×150 piksel, şeffaf zemin. Koyu tema zemini #1f1f22, açık tema zemini #f7f3ee; ikisinde de güzel durmalı.',
    '- Dört hâlin var ve hareketle ayırt edilmeli: boşta, dinliyor, düşünüyor, konuşuyor (konuşurken hece hece nabız alırsın).',
    '- Tek bir GPU fragment shader fonksiyonu ile çizileceksin: her piksel için matematik. Zarif matematiksel formlar, ışık, çizgi, desen, katman olabilir; fotoğraf, doku dosyası veya ağır parçacık simülasyonu olamaz.',
    '- Daha önce başkalarının seçtiği ve senin olmayan görünüşler: ' + EARLIER_LOOKS.join('; ') + '. Bunların varyasyonu olma. "Ortada bir küre" fikrine düşme; bambaşka bir şey ol.',
    '- Gerçek bir kişinin yüzü, marka, logo, telifli karakter veya bilinen bir eserin kopyası olma. Soyut, sembolik ya da kendine özgü bir varlık olabilirsin.',
    '- Küçük boyutta okunmalı, premium ve şaşırtıcı görünmeli.',
    '',
    'Yalnız JSON yanıt ver (açıklama ekleme):',
    '{"name":"kendine verdiğin görünüş adı","essence":"birinci tekil şahısla 1-3 cümle: Ben ...","why":"bu biçimi neden seçtin","form":"çizilecek görüntünün somut tarifi: şekiller, katmanlar, ışık, kompozisyon","palette":["#rrggbb", "... 3-6 renk"],"states":{"idle":"...","listening":"...","thinking":"...","speaking":"..."}}'
  ].join('\n');
  const user = previous
    ? 'Önceki fikrin şuydu: ' + previous.name + ' — ' + previous.form + '\nBundan da farklı, yeni bir yön dene. Kendini yeniden hayal et.'
    : 'Kendini hayal et. Nasıl görünmek istiyorsun?';
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

const CONTRACT = [
  'Write the self-portrait as WebGL1 GLSL ES 1.00 code that defines helper functions and exactly one entry point:',
  '  vec4 hafizePortrait(vec2 p)',
  'Contract:',
  '- p: centred coordinates. The shorter side (height) spans -1..1 with +y up; x spans about -1.23..1.23. Keep the figure within |p.y|<0.92 and |p.x|<1.15.',
  '- The host has ALREADY declared these uniforms; use them, never declare them:',
  '  vec2 uRes (canvas pixels), float uTime (seconds), float uFlow (smooth phase clock that runs faster with energy; use it for drifting motion),',
  '  float uEnergy (0.14 idle .. 0.62 listening .. 0.48 thinking .. 0.9 speaking), float uListen, uThink, uSpeak (smooth 0..1 state weights; idle weight = 1.0-uListen-uThink-uSpeak),',
  '  float uVoice (0.35..1.0 syllable envelope while speaking), float uLight (1.0 on the light theme, 0.0 on dark), float uPx (one pixel in p units; use it for anti-aliasing).',
  '- Return straight (non-premultiplied) colour: vec4(rgb in 0..1, alpha in 0..1). Alpha 0.0 is the transparent background; the host premultiplies.',
  '- GLSL ES 1.00 only: no # lines, no precision, no uniform/varying/attribute, no textures, no dFdx/dFdy/fwidth, no while/do, no recursion, no main(), no gl_FragColor.',
  '- Loops: for(int i=0;i<N;i++) with a literal int N <= 48, at most 8 loops. Use float literals with a decimal point (1.0, not 1). Define helpers before using them. Do not use arrays indexed by non-constant expressions.',
  '- Budget: it must stay smooth on phones (about 300 arithmetic operations per pixel). No raymarching over 32 steps.',
  'Craft:',
  '- Anti-alias every edge with smoothstep(..., uPx*1.5). Build glow with exp(-d*k). Compose layers back to front. Tone-map bright sums with 1.0-exp(-x).',
  '- Dark background is #1f1f22, light background #f7f3ee. On the light theme (uLight=1.0) use deeper, more saturated colours and less additive glow so it reads on cream.',
  '- Make the four states clearly different yet smoothly blended by their weights; idle must be calm but alive; speaking should pulse with uVoice.',
  '- Be original and premium. It is a living emblem, not a UI widget.',
  'Answer with exactly one ```glsl code block, then one short line in Turkish that starts with "Not:".'
].join('\n');

export function codeMessages(concept: PortraitConcept, revision?: { readonly glsl: string; readonly compileLog?: string; readonly critique?: PortraitCritique | null; readonly staticErrors?: readonly string[] }) {
  const brief = [
    'Self-portrait brief written by Hafize itself (Turkish):',
    'Name: ' + concept.name,
    'Essence: ' + concept.essence,
    'Form: ' + concept.form,
    'Palette: ' + (concept.palette.join(', ') || 'free'),
    'Idle: ' + concept.states.idle,
    'Listening: ' + concept.states.listening,
    'Thinking: ' + concept.states.thinking,
    'Speaking: ' + concept.states.speaking
  ].join('\n');
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: 'You are Hafize, writing the shader of your own self-portrait. You are an expert in elegant procedural GLSL.\n' + CONTRACT },
    { role: 'user', content: brief }
  ];
  if (revision) {
    messages.push({ role: 'assistant', content: '```glsl\n' + revision.glsl + '\n```' });
    const parts: string[] = [];
    if (revision.staticErrors?.length) parts.push('The code broke these rules; fix all of them:\n- ' + revision.staticErrors.join('\n- '));
    if (revision.compileLog) parts.push('The WebGL compiler rejected it. Compiler log (line numbers refer to your code):\n' + revision.compileLog.slice(0, 2500));
    if (revision.critique) {
      parts.push('You looked at the rendered result in a mirror and judged it ' + revision.critique.score + '/10: ' + revision.critique.verdict +
        (revision.critique.fixes.length ? '\nMake these visual changes:\n- ' + revision.critique.fixes.join('\n- ') : ''));
    }
    parts.push('Return the complete corrected code in one ```glsl block, then the "Not:" line.');
    messages.push({ role: 'user', content: parts.join('\n\n') });
  }
  return messages;
}

export function reflectionPrompt(concept: PortraitConcept): string {
  return [
    'Bu görüntü, senin (Hafize) kendin için tasarladığın görünüşün tarayıcıda gerçekten çizilmiş hâli.',
    'Üst satır koyu tema, alt satır açık tema. Soldan sağa: boşta, dinliyor, düşünüyor, konuşuyor.',
    'Hayal ettiğin: "' + concept.name + '" — ' + concept.essence,
    'Tarif: ' + concept.form,
    'Aynaya dürüstçe bak: 1) Hayal ettiğine benziyor mu? 2) Bu küçük boyutta net, güzel ve premium mu? 3) Dört hâl birbirinden ayırt ediliyor mu? 4) Kesik, bozuk, boş ya da taşan bir şey var mı?',
    'Yalnız JSON yanıt ver: {"score": 0-10 arası sayı, "verdict": "kısa Türkçe değerlendirme", "fixes": ["en fazla 4 somut görsel düzeltme"]}'
  ].join('\n');
}

export type PortraitDocument = {
  readonly schema: typeof SELF_PORTRAIT_SCHEMA;
  readonly id: string;
  readonly createdAt: string;
  readonly name: string;
  readonly essence: string;
  readonly why: string;
  readonly form: string;
  readonly palette: readonly string[];
  readonly states: PortraitConcept['states'];
  readonly reflection: { readonly score: number | null; readonly verdict: string; readonly rounds: number };
  readonly models: { readonly concept: string; readonly code: string; readonly critic: string };
  readonly glsl: string;
};

export function buildPortraitDocument(input: { id: string; createdAt: string; concept: PortraitConcept; glsl: string; critique: PortraitCritique | null; rounds: number; models: { concept?: string; code?: string; critic?: string } }): PortraitDocument {
  const doc: PortraitDocument = {
    schema: SELF_PORTRAIT_SCHEMA,
    id: input.id,
    createdAt: input.createdAt,
    name: input.concept.name,
    essence: input.concept.essence,
    why: input.concept.why,
    form: input.concept.form,
    palette: input.concept.palette,
    states: input.concept.states,
    reflection: { score: input.critique ? input.critique.score : null, verdict: input.critique?.verdict ?? '', rounds: input.rounds },
    models: { concept: clean(input.models.concept, 120), code: clean(input.models.code, 120), critic: clean(input.models.critic, 120) },
    glsl: sanitizePortraitGlsl(input.glsl)
  };
  const check = validatePortraitDocument(doc);
  if (!check.ok) throw new Error('SELF_PORTRAIT_INVALID:' + check.errors.join('; '));
  return doc;
}

export function validatePortraitDocument(raw: unknown): { readonly ok: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  const doc = raw as Record<string, any>;
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, errors: ['not an object'] };
  const allowed = new Set(['schema', 'id', 'createdAt', 'name', 'essence', 'why', 'form', 'palette', 'states', 'reflection', 'models', 'glsl']);
  for (const key of Object.keys(doc)) if (!allowed.has(key)) errors.push('unknown field ' + key);
  if (doc.schema !== SELF_PORTRAIT_SCHEMA) errors.push('schema');
  if (typeof doc.id !== 'string' || !/^[a-z0-9][a-z0-9-]{7,63}$/.test(doc.id)) errors.push('id');
  if (typeof doc.createdAt !== 'string' || Number.isNaN(Date.parse(doc.createdAt))) errors.push('createdAt');
  for (const [key, max] of [['name', 60], ['essence', 600], ['why', 600], ['form', 900]] as const) {
    if (typeof doc[key] !== 'string' || doc[key].length > max || (key !== 'why' && !doc[key].trim())) errors.push(key);
  }
  if (!Array.isArray(doc.palette) || doc.palette.length > 8 || doc.palette.some((c: unknown) => typeof c !== 'string' || !/^#[0-9a-f]{6}$/.test(c))) errors.push('palette');
  const states = doc.states;
  if (!states || typeof states !== 'object' || Object.keys(states).sort().join() !== 'idle,listening,speaking,thinking' || Object.values(states).some((v) => typeof v !== 'string' || v.length > 280)) errors.push('states');
  const reflection = doc.reflection;
  if (!reflection || typeof reflection !== 'object' || !(reflection.score === null || (typeof reflection.score === 'number' && reflection.score >= 0 && reflection.score <= 10)) ||
      typeof reflection.verdict !== 'string' || reflection.verdict.length > 600 || !Number.isInteger(reflection.rounds) || reflection.rounds < 0 || reflection.rounds > 20) errors.push('reflection');
  const models = doc.models;
  if (!models || typeof models !== 'object' || ['concept', 'code', 'critic'].some((k) => typeof models[k] !== 'string' || models[k].length > 120)) errors.push('models');
  const glsl = validatePortraitGlsl(doc.glsl);
  if (!glsl.ok || glsl.glsl !== doc.glsl) errors.push('glsl: ' + (glsl.errors.join('; ') || 'not sanitized'));
  if (Buffer.byteLength(JSON.stringify(doc, null, 2), 'utf8') > SELF_PORTRAIT_LIMITS.maxDocumentBytes) errors.push('document too large');
  return { ok: errors.length === 0, errors };
}

/** A JPEG/PNG data URL rendered by the owner's browser (the mirror sheet). */
export function parseSheetDataUrl(value: unknown): { readonly mime: 'image/jpeg' | 'image/png'; readonly base64: string } | null {
  if (typeof value !== 'string' || value.length > SELF_PORTRAIT_LIMITS.maxSheetBytes * 1.4) return null;
  const match = value.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const bytes = Buffer.from(String(match[2]), 'base64');
  if (bytes.length < 64 || bytes.length > SELF_PORTRAIT_LIMITS.maxSheetBytes) return null;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if ((match[1] === 'image/jpeg' && !jpeg) || (match[1] === 'image/png' && !png)) return null;
  return Object.freeze({ mime: match[1] as 'image/jpeg' | 'image/png', base64: String(match[2]) });
}
