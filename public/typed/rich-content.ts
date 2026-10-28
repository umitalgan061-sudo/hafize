// Rich content in the chat: diagrams written as code blocks (```mermaid, ```vega-lite, ```dot) are
// drawn under the answer, math ($$…$$, \[…\], \(…\)) is typeset with KaTeX, and the composer can
// attach images (uploaded for the vision model), PDFs (text extracted in the browser; scanned pages
// go to the vision model as images) and videos (key frames as one contact sheet). The heavy
// libraries load only when needed.
import { hafizeApi } from './hafize-api.ts';

type Any = any;
const DIAGRAM_LANGUAGES: Record<string, 'mermaid' | 'vega-lite' | 'graphviz'> = { mermaid: 'mermaid', 'vega-lite': 'vega-lite', vegalite: 'vega-lite', 'vega_lite': 'vega-lite', dot: 'graphviz', graphviz: 'graphviz' };
const VENDOR = '/typed-build/vendor';
const IMAGE_TYPES = /^image\/(png|jpeg|webp|gif|bmp)$/;
const MAX_IMAGE_SIDE = 2048;
const MAX_PDF_BYTES = 40 * 1024 * 1024;
const MAX_PDF_PAGES = 80;
const MAX_PDF_TEXT = 30_000;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const VIDEO_FRAMES = 6;

// --- helpers -----------------------------------------------------------------------------
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(new Error('dosya okunamadı'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('görsel dönüştürülemedi'))), type, quality));
}

function safeName(name: string): string {
  return String(name || 'dosya').replace(/[[\]()\n\r]/g, ' ').trim().slice(0, 80) || 'dosya';
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

async function uploadCanvas(canvas: HTMLCanvasElement, name: string): Promise<string> {
  const blob = await canvasToBlob(canvas);
  const stored = await hafizeApi.uploadImage(await blobToBase64(blob), name);
  return stored.url;
}

// --- media attachments -----------------------------------------------------------------
async function prepareImage(file: File) {
  let blob: Blob = file;
  // Large photos are scaled down before upload; the vision model gains nothing above ~2k pixels.
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('görsel çözümlenemedi');
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale < 1 || file.size > 6 * 1024 * 1024 || file.type === 'image/bmp') {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await canvasToBlob(canvas);
  }
  bitmap.close?.();
  const stored = await hafizeApi.uploadImage(await blobToBase64(blob), file.name);
  return { block: `\n\n![${safeName(file.name)}](${stored.url})\n`, message: `${file.name} eklendi; Hafize görseli inceleyecek.` };
}

let pdfjsPromise: Promise<Any> | null = null;
function loadPdfjs(): Promise<Any> {
  pdfjsPromise ||= import('pdfjs-dist').then((pdfjs: Any) => {
    pdfjs.GlobalWorkerOptions.workerSrc = `${VENDOR}/pdf.worker.min.mjs`;
    return pdfjs;
  });
  return pdfjsPromise;
}

async function preparePdf(file: File) {
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF 40 MB sınırını aşıyor');
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  let text = '';
  for (let number = 1; number <= pages && text.length < MAX_PDF_TEXT; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: Any) => (typeof item.str === 'string' ? item.str + (item.hasEOL ? '\n' : ' ') : '')).join('').replace(/[ \t]+\n/g, '\n').trim();
    if (pageText) text += `\n[Sayfa ${number}]\n${pageText}\n`;
  }
  if (text.replace(/\[Sayfa \d+\]/g, '').trim().length > 40) {
    const clipped = text.slice(0, MAX_PDF_TEXT);
    const notice = text.length > MAX_PDF_TEXT || pdf.numPages > pages ? `\n[PDF uzun olduğu için ilk ${pages} sayfanın ilk ${MAX_PDF_TEXT} karakteri eklendi.]\n` : '';
    return { block: `\n\n[Ekli PDF: ${safeName(file.name)} — ${pdf.numPages} sayfa]\n---\n${clipped.trim()}${notice}\n---\n`, message: `${file.name} eklendi (${pdf.numPages} sayfa metin olarak okundu).` };
  }
  // A scanned PDF has no text layer: the first pages go to the vision model as images (OCR).
  const urls: string[] = [];
  for (let number = 1; number <= Math.min(pdf.numPages, 3); number += 1) {
    const page = await pdf.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1600 / Math.max(viewport.width, viewport.height));
    const scaled = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(scaled.width);
    canvas.height = Math.round(scaled.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled }).promise;
    urls.push(await uploadCanvas(canvas, `${file.name}-sayfa-${number}.jpg`));
  }
  return { block: `\n\n[Ekli taranmış PDF: ${safeName(file.name)} — ${pdf.numPages} sayfa; ilk ${urls.length} sayfa görsel olarak eklendi]\n${urls.map((url, index) => `![${safeName(file.name)} sayfa ${index + 1}](${url})`).join('\n')}\n`, message: `${file.name} taranmış bir PDF; ilk sayfalar görsel olarak eklendi, Hafize metni okuyacak.` };
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('video karesi alınamadı')), 8_000);
    video.addEventListener('seeked', () => { window.clearTimeout(timer); resolve(); }, { once: true });
    video.currentTime = time;
  });
}

async function prepareVideo(file: File) {
  if (file.size > MAX_VIDEO_BYTES) throw new Error('video 500 MB sınırını aşıyor');
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('bu video biçimi tarayıcıda açılamıyor')), { once: true });
    });
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    if (!duration || !video.videoWidth) throw new Error('video süresi okunamadı');
    // Six evenly spaced frames in one 3x2 contact sheet: one image keeps the vision call small.
    const frameWidth = Math.min(640, video.videoWidth);
    const frameHeight = Math.round(frameWidth * (video.videoHeight / video.videoWidth));
    const columns = 3;
    const rows = Math.ceil(VIDEO_FRAMES / columns);
    const sheet = document.createElement('canvas');
    sheet.width = frameWidth * columns;
    sheet.height = (frameHeight + 28) * rows;
    const context = sheet.getContext('2d')!;
    context.fillStyle = '#111';
    context.fillRect(0, 0, sheet.width, sheet.height);
    const times: number[] = [];
    for (let index = 0; index < VIDEO_FRAMES; index += 1) {
      const time = Math.min(duration - 0.05, (duration * (index + 0.5)) / VIDEO_FRAMES);
      await seek(video, Math.max(0, time));
      const x = (index % columns) * frameWidth;
      const y = Math.floor(index / columns) * (frameHeight + 28);
      context.drawImage(video, x, y + 28, frameWidth, frameHeight);
      context.fillStyle = '#fff';
      context.font = '18px sans-serif';
      context.fillText(`${index + 1}. kare · ${formatTime(time)}`, x + 8, y + 20);
      times.push(time);
    }
    const imageUrl = await uploadCanvas(sheet, `${file.name}-kareler.jpg`);
    return {
      block: `\n\n[Ekli video: ${safeName(file.name)} — süre ${formatTime(duration)}; ${VIDEO_FRAMES} anahtar kare (${times.map(formatTime).join(', ')}) tek görselde. Ses içeriği dahil değildir.]\n![${safeName(file.name)} kareleri](${imageUrl})\n`,
      message: `${file.name} eklendi; videodan ${VIDEO_FRAMES} kare alındı, Hafize kareleri inceleyecek.`
    };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}

function kindOf(file: File): 'image' | 'pdf' | 'video' | null {
  if (IMAGE_TYPES.test(file.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) return 'image';
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (/^video\/(mp4|webm|quicktime|ogg)$/.test(file.type) || /\.(mp4|webm|mov|ogv)$/i.test(file.name)) return 'video';
  return null;
}

(window as Any).HafizeMediaAttachments = Object.freeze({
  supports: (file: File) => Boolean(file && kindOf(file)),
  async prepare(file: File) {
    const kind = kindOf(file);
    if (kind === 'image') return prepareImage(file);
    if (kind === 'pdf') return preparePdf(file);
    if (kind === 'video') return prepareVideo(file);
    throw new Error('desteklenmeyen dosya türü');
  }
});

// --- diagrams ----------------------------------------------------------------------------
const svgCache = new Map<string, string>();
let mermaidPromise: Promise<Any> | null = null;
let vegaPromise: Promise<Any> | null = null;
let vizPromise: Promise<Any> | null = null;

/** Strips anything active from an SVG produced from model-written source. */
function sanitizeSvg(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') throw new Error('geçersiz SVG');
  for (const node of [...root.querySelectorAll('script, foreignObject, iframe, object, embed')]) node.remove();
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on')) element.removeAttribute(attribute.name);
      else if ((name === 'href' || name === 'xlink:href' || name === 'src') && !value.startsWith('#') && !value.startsWith('data:image/')) element.removeAttribute(attribute.name);
      else if (name === 'style' && /url\(|expression|javascript:/.test(value)) element.removeAttribute(attribute.name);
    }
  }
  return new XMLSerializer().serializeToString(root);
}

async function renderSource(kind: 'mermaid' | 'vega-lite' | 'graphviz', source: string): Promise<string> {
  const key = `${kind}\u0000${source}`;
  const cached = svgCache.get(key);
  if (cached) return cached;
  let svg: string;
  const dark = document.documentElement.dataset.theme === 'dark' || document.body.classList.contains('dark');
  if (kind === 'mermaid') {
    mermaidPromise ||= import('mermaid').then((module: Any) => module.default);
    const mermaid = await mermaidPromise;
    // Labels as SVG text: HTML labels live in foreignObject, which the sanitizer removes.
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', htmlLabels: false, flowchart: { htmlLabels: false }, class: { htmlLabels: false }, state: { htmlLabels: false } } as Any);
    const { svg: output } = await mermaid.render(`hz-diagram-${Math.random().toString(36).slice(2)}`, source);
    svg = output;
  } else if (kind === 'vega-lite') {
    vegaPromise ||= Promise.all([import('vega-embed'), import('vega'), import('vega-interpreter')]).then(([embed, vega, interpreter]: Any[]) => ({ embed: embed.default, vega, expr: interpreter.expressionInterpreter }));
    const { embed, vega, expr } = await vegaPromise;
    const spec = JSON.parse(source);
    // Charts may not pull data or images from the internet on their own.
    const loader = vega.loader();
    loader.sanitize = async (uri: string) => { if (/^data:/.test(uri)) return { href: uri }; throw new Error('dış veri kapalı'); };
    const host = document.createElement('div');
    const result = await embed(host, spec, { renderer: 'svg', actions: false, loader, ast: true, expr, ...(dark ? { theme: 'dark' } : {}) });
    svg = await result.view.toSVG();
    result.finalize?.();
  } else {
    vizPromise ||= import('@viz-js/viz').then((module: Any) => module.instance());
    const viz = await vizPromise;
    svg = viz.renderString(source, { format: 'svg' });
  }
  const clean = sanitizeSvg(svg);
  if (svgCache.size > 100) svgCache.delete(svgCache.keys().next().value!);
  svgCache.set(key, clean);
  return clean;
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function svgToPng(svg: string): Promise<Blob> {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('PNG oluşturulamadı')); image.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, image.naturalWidth * 2);
    canvas.height = Math.max(1, image.naturalHeight * 2);
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await canvasToBlob(canvas, 'image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderDiagramBlock(block: HTMLElement): Promise<void> {
  const language = String(block.dataset.language || '').toLowerCase();
  const kind = DIAGRAM_LANGUAGES[language];
  const source = block.querySelector('.md-code-body code')?.textContent || '';
  if (!kind || !source.trim() || block.dataset.diagramSource === source) return;
  block.dataset.diagramSource = source;
  let figure = block.previousElementSibling as HTMLElement | null;
  if (!figure?.classList.contains('md-diagram')) {
    figure = document.createElement('figure');
    figure.className = 'md-diagram';
    block.before(figure);
  }
  figure.replaceChildren();
  figure.setAttribute('aria-busy', 'true');
  try {
    const svg = await renderSource(kind, source);
    const canvas = document.createElement('div');
    canvas.className = 'md-diagram-canvas';
    canvas.innerHTML = svg; // sanitized above: no scripts, handlers or outside references
    const tools = document.createElement('div');
    tools.className = 'md-diagram-tools';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    // Labels come from CSS (data-label): textContent of an answer must stay the answer itself.
    toggle.dataset.label = 'Kodu göster';
    toggle.setAttribute('aria-label', 'Diyagramın kaynak kodunu göster');
    toggle.addEventListener('click', () => {
      const hidden = block.classList.toggle('md-code-collapsed');
      toggle.dataset.label = hidden ? 'Kodu göster' : 'Kodu gizle';
    });
    const saveSvg = document.createElement('button');
    saveSvg.type = 'button';
    saveSvg.dataset.label = 'SVG indir';
    saveSvg.setAttribute('aria-label', 'Diyagramı SVG olarak indir');
    saveSvg.addEventListener('click', () => download('hafize-diyagram.svg', new Blob([svg], { type: 'image/svg+xml' })));
    const savePng = document.createElement('button');
    savePng.type = 'button';
    savePng.dataset.label = 'PNG indir';
    savePng.setAttribute('aria-label', 'Diyagramı PNG olarak indir');
    savePng.addEventListener('click', () => { void svgToPng(svg).then((blob) => download('hafize-diyagram.png', blob)).catch(() => {}); });
    tools.append(toggle, saveSvg, savePng);
    figure.append(canvas, tools);
    block.classList.add('md-code-collapsed');
  } catch (error) {
    const note = document.createElement('figcaption');
    note.className = 'md-diagram-error';
    note.textContent = `Diyagram çizilemedi: ${String((error as Error)?.message || error).slice(0, 160)}`;
    figure.append(note);
    block.classList.remove('md-code-collapsed');
  } finally {
    figure.removeAttribute('aria-busy');
  }
}

// --- math --------------------------------------------------------------------------------
let katexPromise: Promise<Any> | null = null;
function loadKatex(): Promise<Any> {
  if (!katexPromise) {
    if (!document.querySelector('link[data-hafize-katex]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${VENDOR}/katex/katex.min.css`;
      link.dataset.hafizeKatex = 'true';
      document.head.append(link);
    }
    katexPromise = import('katex/contrib/auto-render').then((module: Any) => module.default);
  }
  return katexPromise;
}

const MATH_PATTERN = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/;
async function renderMath(content: HTMLElement): Promise<void> {
  const text = content.textContent || '';
  if (!MATH_PATTERN.test(text) || content.dataset.mathSource === text) return;
  const renderMathInElement = await loadKatex();
  renderMathInElement(content, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false }
    ],
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
    throwOnError: false,
    trust: false,
    strict: 'ignore'
  });
  content.dataset.mathSource = content.textContent || '';
}

// --- scheduling: process answers once they stop streaming --------------------------------
const messages = document.querySelector<HTMLElement>('#messages');
let pending = 0;
function scan(): void {
  if (!messages || messages.getAttribute('aria-busy') === 'true') return;
  for (const block of messages.querySelectorAll<HTMLElement>('.md-code[data-language]:not([data-streaming])')) {
    if (DIAGRAM_LANGUAGES[String(block.dataset.language || '').toLowerCase()]) void renderDiagramBlock(block);
  }
  for (const content of messages.querySelectorAll<HTMLElement>('.message.assistant .content')) void renderMath(content).catch(() => {});
}
function schedule(): void {
  window.clearTimeout(pending);
  pending = window.setTimeout(scan, 250);
}
if (messages) {
  new MutationObserver(schedule).observe(messages, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-busy'] });
  schedule();
}
