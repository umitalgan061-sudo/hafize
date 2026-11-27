// @ts-nocheck
// A canvas-first, dependency-free visual attached to the real image_generate tool activity.
type ImageGenerationState = 'queued' | 'generating' | 'refining' | 'complete' | 'error';

const labels: Record<ImageGenerationState, string> = {
  queued: 'Üretim sırası hazırlanıyor',
  generating: 'Hafize görseli dokuyor',
  refining: 'Işık ve ayrıntılar işleniyor',
  complete: 'Görsel hazır',
  error: 'Görsel üretilemedi'
};

function stateFor(activity: any, content = ''): ImageGenerationState {
  if (activity?.state === 'failure') return 'error';
  if (activity?.state === 'success') return 'complete';
  if (content && content !== 'Hafize düşünüyor…') return 'refining';
  return activity?.state === 'running' ? 'generating' : 'queued';
}

function imageUrlFrom(markdown = '') {
  const match = markdown.match(/!\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/u);
  return match?.[1]?.replace(/^<|>$/g, '') || '';
}

function createCanvasAnimator(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return () => {};
  let pointer = { x: .5, y: .45, active: false };
  let frame = 0;
  let destroyed = false;
  const motionReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * scale));
    canvas.height = Math.max(1, Math.round(box.height * scale));
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const move = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    pointer = { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height, active: true };
  };
  const leave = () => { pointer.active = false; };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerleave', leave);
  const draw = (time: number) => {
    if (destroyed) return;
    const width = canvas.width, height = canvas.height;
    const scale = Math.min(devicePixelRatio || 1, 2);
    const w = width / scale, h = height / scale;
    context.clearRect(0, 0, width, height);
    context.save(); context.scale(scale, scale);
    const t = motionReduced.matches ? 1.8 : time / 1400;
    const step = Math.max(4, Math.round(Math.min(w, h) / 39));
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const nx = x / w, ny = y / h;
      const drift = Math.sin(nx * 7.4 + t) * .035 + Math.cos(ny * 8.8 - t * .8) * .028;
      const distance = Math.hypot(nx - .5 - drift, ny - .49 + drift * .35);
      const focus = pointer.active ? Math.hypot(nx - pointer.x, ny - pointer.y) : 1;
      const wave = Math.sin(distance * 31 - t * 3.2) * .45 + .55;
      const density = Math.max(0, 1 - distance * 1.82) * (.58 + wave * .42) * (pointer.active ? Math.max(.28, 1 - focus * 1.1) : 1);
      if (density < .11) continue;
      const radius = (.38 + density * 1.75) * (1 + Math.sin((x + y) * .08 + t) * .12);
      const hue = 21 + density * 18;
      context.beginPath();
      context.fillStyle = `hsla(${hue}, 93%, ${58 + density * 24}%, ${.15 + density * .8})`;
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    frame = requestAnimationFrame(draw);
  };
  resize(); frame = requestAnimationFrame(draw);
  return () => { destroyed = true; cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave); };
}

function iconFor(state: ImageGenerationState) {
  if (state === 'complete') return '✦';
  if (state === 'error') return '!';
  return '✧';
}

export function mountImageGenerationVisual(host: HTMLElement, activity: any, content = '') {
  if (!host) return;
  const state = stateFor(activity, content);
  let card = host.querySelector<HTMLElement>('.image-generation-visual');
  if (!card) {
    card = document.createElement('section');
    card.className = 'image-generation-visual';
    card.setAttribute('aria-live', 'polite');
    card.innerHTML = '<div class="image-generation-ambient" aria-hidden="true"></div><canvas class="image-generation-canvas" aria-hidden="true"></canvas><div class="image-generation-scan" aria-hidden="true"></div><div class="image-generation-copy"><div class="image-generation-kicker"><span class="image-generation-icon"></span><span class="image-generation-eyebrow">HAFİZE · IMAGE STUDIO</span><span class="image-generation-percent">CANLI</span></div><strong class="image-generation-label"></strong><span class="image-generation-detail">Noktalardan ışığa, ışıklardan görsele.</span></div><div class="image-generation-result" aria-hidden="true"></div>';
    host.replaceChildren(card);
    (card as any)._disposeImageVisual = createCanvasAnimator(card.querySelector('canvas')!);
  }
  card.dataset.state = state;
  card.querySelector('.image-generation-icon')!.textContent = iconFor(state);
  card.querySelector('.image-generation-label')!.textContent = labels[state];
  const detail = card.querySelector('.image-generation-detail')!;
  detail.textContent = state === 'complete' ? 'Üretim tamamlandı · görselin ayrıntıları korunuyor.' : state === 'error' ? 'Bağlantıyı kontrol edip yeniden deneyebilirsin.' : 'Noktalardan ışığa, ışıklardan görsele.';
  const result = card.querySelector<HTMLElement>('.image-generation-result')!;
  const url = imageUrlFrom(content);
  if (url) {
    const old = result.querySelector('img') as HTMLImageElement | null;
    if (!old || old.src !== new URL(url, location.href).href) {
      const image = new Image(); image.alt = ''; image.src = url; image.decoding = 'async';
      result.replaceChildren(image);
    }
  }
}

export function removeImageGenerationVisual(host: HTMLElement) {
  const card = host?.querySelector?.('.image-generation-visual') as any;
  card?._disposeImageVisual?.();
  host?.replaceChildren();
}
