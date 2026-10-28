// Multimodal tools: image generation (with a content-safety gate), a private image store (generated
// images, uploads, rendered diagrams, page screenshots), vision analysis of stored images, diagram
// rendering (Mermaid, Vega-Lite, Graphviz -> SVG + PNG in headless Chrome) and rendering of
// JavaScript-heavy web pages.
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { HeadlessBrowser } from './headless-browser.ts';
import type { ModelServices } from './model-services.ts';
import { parsePublicUrl } from './web-tools.ts';
import { redactPlaintextCredentials } from './plaintext-credential-policy.ts';

const NODE_MODULES = fileURLToPath(new URL('../node_modules/', import.meta.url));
const EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' });
export const MEDIA_LIMITS = Object.freeze({ maxUploadBytes: 8 * 1024 * 1024, maxPrompt: 1_500, maxDiagram: 20_000, maxVisionImages: 4 });
const IMAGE_ID = /^img_[a-f0-9]{20}$/;

export class MediaToolError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'MediaToolError'; this.code = code; this.status = status; }
}

/** Detects the real image type from magic bytes; the declared type is never trusted. */
export function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('latin1'))) return 'image/gif';
  return null;
}

export function createImageStore({ db, dir, now = () => Date.now() }: { readonly db: DatabaseSync; readonly dir: string; readonly now?: () => number }) {
  mkdirSync(dir, { recursive: true });

  function save({ ownerId, bytes, mime, model, prompt = '', seed = 0 }: { readonly ownerId: string; readonly bytes: Buffer; readonly mime: string; readonly model: string; readonly prompt?: string; readonly seed?: number }) {
    const extension = EXTENSIONS[mime];
    if (!extension) throw new MediaToolError('UNSUPPORTED_IMAGE_TYPE', 415);
    const id = `img_${randomBytes(10).toString('hex')}`;
    writeFileSync(join(dir, `${id}.${extension}`), bytes, { flag: 'wx' });
    db.prepare('INSERT INTO images (id, owner_id, model, prompt, seed, mime, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, ownerId, model.slice(0, 120), prompt.slice(0, 2_000), Math.trunc(seed) || 0, mime, now());
    return { id, url: `/api/images/${id}`, mime };
  }

  function read(id: string, ownerId: string): { bytes: Buffer; mime: string; prompt: string; model: string } | null {
    if (!IMAGE_ID.test(id)) return null;
    const row = db.prepare('SELECT mime, prompt, model FROM images WHERE id = ? AND owner_id = ?').get(id, ownerId) as { mime: string; prompt: string; model: string } | undefined;
    if (!row) return null;
    try { return { bytes: readFileSync(join(dir, `${id}.${EXTENSIONS[row.mime]}`)), mime: row.mime, prompt: row.prompt, model: row.model }; } catch { return null; }
  }

  function remove(id: string, ownerId: string): boolean {
    const row = db.prepare('SELECT mime FROM images WHERE id = ? AND owner_id = ?').get(id, ownerId) as { mime: string } | undefined;
    if (!row) return false;
    db.prepare('DELETE FROM images WHERE id = ?').run(id);
    try { unlinkSync(join(dir, `${id}.${EXTENSIONS[row.mime]}`)); } catch {}
    return true;
  }

  function list(ownerId: string, limit = 50) {
    return db.prepare('SELECT id, model, prompt, mime, created_at AS createdAt FROM images WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?').all(ownerId, Math.min(Math.max(limit, 1), 200));
  }

  /** Image ids referenced as /api/images/<id> in a text. */
  function referencedIds(text: string): string[] {
    return [...new Set([...String(text).matchAll(/\/api\/images\/(img_[a-f0-9]{20})/g)].map((match) => match[1]!))].slice(0, MEDIA_LIMITS.maxVisionImages);
  }

  return Object.freeze({ save, read, remove, list, referencedIds, dir });
}
export type ImageStore = ReturnType<typeof createImageStore>;

let diagramLibraries: { mermaid: string; vega: string; vegaLite: string; vegaEmbed: string; viz: string } | null = null;
function libraries() {
  if (!diagramLibraries) {
    const file = (relativePath: string) => readFileSync(join(NODE_MODULES, relativePath), 'utf8');
    diagramLibraries = {
      mermaid: file('mermaid/dist/mermaid.min.js'),
      vega: file('vega/build/vega.min.js'),
      vegaLite: file('vega-lite/build/vega-lite.min.js'),
      vegaEmbed: file('vega-embed/build/vega-embed.min.js'),
      viz: file('@viz-js/viz/dist/viz-global.js')
    };
  }
  return diagramLibraries;
}

export function createMediaTools({ models, images, browser }: { readonly models: Pick<ModelServices, 'generateImage' | 'safetyCheck' | 'vision'>; readonly images: ImageStore; readonly browser: HeadlessBrowser }) {
  async function generateImage({ ownerId, prompt, width = 1024, height = 1024, seed, traceId = '', signal }: { readonly ownerId: string; readonly prompt: unknown; readonly width?: unknown; readonly height?: unknown; readonly seed?: unknown; readonly traceId?: string; readonly signal?: AbortSignal | undefined }) {
    const text = typeof prompt === 'string' ? prompt.replace(/\s+/g, ' ').trim() : '';
    if (!text || text.length > MEDIA_LIMITS.maxPrompt) throw new MediaToolError('INVALID_IMAGE_PROMPT');
    const size = (value: unknown) => {
      const number = Number(value);
      return [512, 768, 1024, 1280].includes(number) ? number : 1024;
    };
    const verdict = await models.safetyCheck(`Bu açıklamaya göre bir görsel üret: ${text}`, { traceId, signal });
    if (!verdict.safe) throw Object.assign(new MediaToolError('IMAGE_PROMPT_UNSAFE', 422), { detail: verdict.categories });
    const result = await models.generateImage({ prompt: text, width: size(width), height: size(height), seed: Number.isInteger(seed) ? Number(seed) : undefined, signal });
    const stored = images.save({ ownerId, bytes: result.bytes, mime: result.mime, model: result.model, prompt: text, seed: result.seed });
    return { id: stored.id, url: stored.url, markdown: `![${text.slice(0, 80).replace(/[[\]]/g, '')}](${stored.url})`, revisedPrompt: text, seed: result.seed, model: result.model, safetyChecked: verdict.checked, note: 'Görseli kullanıcıya göstermek için yanıtına markdown satırını aynen ekle.' };
  }

  async function analyze({ ownerId, imageIds, prompt, traceId = '', signal }: { readonly ownerId: string; readonly imageIds: unknown; readonly prompt?: unknown; readonly traceId?: string; readonly signal?: AbortSignal | undefined }) {
    const ids = Array.isArray(imageIds) ? imageIds.map(String).slice(0, MEDIA_LIMITS.maxVisionImages) : [];
    if (!ids.length) throw new MediaToolError('VISION_NO_IMAGES');
    const loaded = ids.map((id) => images.read(id, ownerId));
    if (loaded.some((item) => !item)) throw new MediaToolError('IMAGE_NOT_FOUND', 404);
    const usable = loaded.filter((item) => item!.mime !== 'image/svg+xml' && item!.mime !== 'image/gif') as Array<{ bytes: Buffer; mime: string }>;
    if (!usable.length) throw new MediaToolError('VISION_UNSUPPORTED_IMAGE');
    const result = await models.vision({ images: usable.map((item) => ({ mime: item.mime, base64: item.bytes.toString('base64') })), prompt: typeof prompt === 'string' ? prompt.slice(0, 2_000) : undefined, traceId, signal });
    return { analysis: redactPlaintextCredentials(result.text).slice(0, 12_000), model: result.model, images: ids };
  }

  async function renderDiagram({ ownerId, kind, source }: { readonly ownerId: string; readonly kind: unknown; readonly source: unknown }) {
    const type = String(kind || '').toLowerCase();
    const text = typeof source === 'string' ? source : source && typeof source === 'object' ? JSON.stringify(source) : '';
    if (!['mermaid', 'vega-lite', 'graphviz'].includes(type)) throw new MediaToolError('UNSUPPORTED_DIAGRAM_KIND');
    if (!text.trim() || text.length > MEDIA_LIMITS.maxDiagram) throw new MediaToolError('INVALID_DIAGRAM_SOURCE');
    const libs = libraries();
    const page = await browser.openPage({ guardNetwork: true, width: 1400, height: 1000 });
    try {
      // viz.js resolves its own URL against document.baseURI, which about:blank cannot provide.
      await page.evaluate(`(() => { const base = document.createElement('base'); base.href = 'https://hafize-render.invalid/'; document.head.appendChild(base); })();document.body.style.margin='0';document.body.style.background='#ffffff';document.body.innerHTML='<div id="d" style="display:inline-block;padding:16px;background:#fff"></div>';true`);
      let svg: string;
      if (type === 'mermaid') {
        await page.evaluate(libs.mermaid + ';true');
        svg = await page.evaluate<string>(`(async () => { mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' }); const { svg } = await mermaid.render('hafize-diagram', ${JSON.stringify(text)}); document.getElementById('d').innerHTML = svg; return svg; })()`);
      } else if (type === 'vega-lite') {
        let spec: unknown;
        try { spec = JSON.parse(text); } catch { throw new MediaToolError('INVALID_VEGA_LITE_JSON'); }
        await page.evaluate(`${libs.vega};${libs.vegaLite};${libs.vegaEmbed};true`);
        svg = await page.evaluate<string>(`(async () => { const spec = ${JSON.stringify(spec)}; delete spec.usermeta; const result = await vegaEmbed('#d', spec, { renderer: 'svg', actions: false }); return result.view.toSVG(); })()`);
      } else {
        await page.evaluate(libs.viz + ';true');
        svg = await page.evaluate<string>(`(async () => { const viz = await Viz.instance(); const el = viz.renderSVGElement(${JSON.stringify(text)}); document.getElementById('d').appendChild(el); return el.outerHTML; })()`);
      }
      if (!svg || !svg.includes('<svg')) throw new MediaToolError('DIAGRAM_RENDER_FAILED', 422);
      const box = await page.evaluate<{ x: number; y: number; width: number; height: number }>(`(() => { const r = document.getElementById('d').getBoundingClientRect(); return { x: r.x, y: r.y, width: Math.ceil(r.width), height: Math.ceil(r.height) }; })()`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...box, width: Math.max(1, Math.min(box.width, 4000)), height: Math.max(1, Math.min(box.height, 4000)), scale: 2 }, captureBeyondViewport: true }) as { data?: string };
      const svgImage = images.save({ ownerId, bytes: Buffer.from(svg, 'utf8'), mime: 'image/svg+xml', model: `diagram:${type}`, prompt: text.slice(0, 2_000) });
      const pngImage = shot.data ? images.save({ ownerId, bytes: Buffer.from(shot.data, 'base64'), mime: 'image/png', model: `diagram:${type}`, prompt: text.slice(0, 2_000) }) : null;
      return { kind: type, svgUrl: svgImage.url, ...(pngImage ? { pngUrl: pngImage.url, markdown: `![Diyagram](${pngImage.url})` } : {}), note: 'Diyagramı göstermek için markdown satırını yanıtına ekle; SVG bağlantısı indirme içindir.' };
    } catch (error) {
      if (error instanceof MediaToolError) throw error;
      throw Object.assign(new MediaToolError('DIAGRAM_RENDER_FAILED', 422), { detail: String((error as Error).message).slice(0, 300) });
    } finally {
      await page.close();
    }
  }

  async function renderPage({ ownerId, url, screenshot = false }: { readonly ownerId: string; readonly url: unknown; readonly screenshot?: unknown }) {
    const target = parsePublicUrl(String(url || '')).toString();
    const page = await browser.openPage({ guardNetwork: true });
    try {
      const loaded = browser.waitForLoad(20_000);
      const navigation = await page.send('Page.navigate', { url: target }) as { errorText?: string };
      if (navigation.errorText) throw new MediaToolError('WEB_RENDER_FAILED', 502);
      await loaded;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const content = await page.evaluate<{ title: string; text: string; url: string }>(`({ title: document.title, text: (document.body ? document.body.innerText : '').slice(0, 60000), url: location.href })`);
      let shot: { url: string } | null = null;
      if (screenshot === true) {
        const capture = await page.send('Page.captureScreenshot', { format: 'png' }) as { data?: string };
        if (capture.data) shot = images.save({ ownerId, bytes: Buffer.from(capture.data, 'base64'), mime: 'image/png', model: 'web-render', prompt: target });
      }
      const text = redactPlaintextCredentials(content.text.replace(/\n{3,}/g, '\n\n').trim());
      return { url: content.url, title: redactPlaintextCredentials(content.title).slice(0, 300), content: text.slice(0, 12_000), truncated: text.length > 12_000, ...(shot ? { screenshotUrl: shot.url, markdown: `![Ekran görüntüsü](${shot.url})` } : {}) };
    } finally {
      await page.close();
    }
  }

  return Object.freeze({ generateImage, analyze, renderDiagram, renderPage });
}
export type MediaTools = ReturnType<typeof createMediaTools>;
