// The welcome screen's picture: the owner turning all the way round in orange pixels, from their own video. The
// points gather first, and touching the picture sends them apart and back. The frames are fetched once, it only draws
// while it can be seen, and it faces front without moving if motion is turned off.
import { HERO } from './original-hero-pixels.js';

const FRAMES_URL = '/hero-donus.bin';
const ASSEMBLE_MS = 1500;
const SCATTER_MS = 650;
const FRAME_MS = 1000 / 12;
const BLEND_FRAMES = 4; // the last frames dissolve into the first, so the turn has no visible joint

export const HERO_CSS = `
.hz-hero-on .hero-logo{display:none}
.hz-hero{display:block;width:min(210px,50vw);height:auto;aspect-ratio:${HERO.width}/${HERO.height};margin:0 auto 12px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
@media (max-height:760px){.hz-hero{width:min(120px,34vw);margin-bottom:8px}}
@media (max-height:620px){.hz-hero{width:84px}}
@media (max-height:500px){.hz-hero{display:none}}
`;

const hash = (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 1000 / 1000;
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (value) => Math.max(0, Math.min(1, value));
const FRAME_BYTES = Math.ceil((HERO.width * HERO.height) / 8);

// What does not depend on the frame is worked out once: where each cell flies from, and which cells the fade removes.
const CELLS = Array.from({ length: HERO.width * HERO.height }, (_, index) => {
  const x = index % HERO.width;
  const y = (index / HERO.width) | 0;
  const fromBottom = HERO.height - y;
  return {
    x,
    y,
    faded: fromBottom < HERO.fadeRows && hash(x * 7 + 3, y * 11 + 5) > fromBottom / HERO.fadeRows,
    blend: hash(x, y),
    angle: hash(x, y) * Math.PI * 2,
    reach: Math.sqrt(hash(y + 7, x + 3)),
    delay: hash(x * 3 + 1, y * 5 + 2) * 0.45
  };
});

export function mountHero() {
  const welcome = document.querySelector('#welcome');
  if (!welcome || welcome.dataset.heroMounted) return;
  const canvas = welcome.querySelector('.hz-hero');
  if (!canvas) return;
  welcome.dataset.heroMounted = 'true';
  const fallback = () => {
    canvas.remove();
    welcome.classList.remove('hz-hero-on');
    welcome.classList.add('hz-hero-fallback');
  };
  const context = canvas.getContext('2d');
  if (!context) { fallback(); return; }
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { data: null, progress: still.matches ? 1 : 0, from: 0, to: 1, startedAt: 0, duration: ASSEMBLE_MS, frame: 0, position: 0, lastStep: 0, onScreen: true, width: 0, height: 0, scale: 1 };

  const fit = () => {
    const box = canvas.getBoundingClientRect();
    if (!box.width) return false;
    state.scale = Math.min(3, window.devicePixelRatio || 1);
    state.width = box.width;
    state.height = box.height;
    const width = Math.round(box.width * state.scale);
    const height = Math.round(box.height * state.scale);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return true;
  };
  const lit = (base, frame, index) => (state.data[(base + frame) * FRAME_BYTES + (index >> 3)] >> (7 - (index & 7))) & 1;
  const draw = () => {
    if (!state.data) return;
    const base = document.documentElement.dataset.theme === 'light' ? HERO.frames : 0;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--premium-orange').trim() || '#dd7a52';
    const cell = state.width / HERO.width;
    const row = state.height / HERO.height;
    const size = Math.max(0.5, cell * 0.94);
    const frame = state.position;
    const next = (frame + 1) % HERO.frames;
    const mix = frame >= HERO.frames - BLEND_FRAMES ? (frame - (HERO.frames - BLEND_FRAMES) + 1) / BLEND_FRAMES : 0;
    const whole = state.progress >= 1;
    context.setTransform(state.scale, 0, 0, state.scale, 0, 0);
    context.clearRect(0, 0, state.width, state.height);
    context.fillStyle = color;
    for (let index = 0; index < CELLS.length; index += 1) {
      const item = CELLS[index];
      if (item.faded || !lit(base, mix && item.blend < mix ? next : frame, index)) continue;
      const homeX = item.x * cell;
      const homeY = item.y * row;
      if (whole) { context.fillRect(homeX, homeY, size, size); continue; }
      const apart = 1 - ease(clamp((state.progress - item.delay) / (1 - item.delay)));
      context.globalAlpha = 1 - apart * 0.85;
      const radius = item.reach * state.width * 0.48;
      context.fillRect(homeX + apart * (state.width / 2 + Math.cos(item.angle) * radius - homeX), homeY + apart * (state.height / 2 + Math.sin(item.angle) * radius - homeY), size, size);
    }
    context.globalAlpha = 1;
  };
  const visible = () => state.data && state.onScreen && document.visibilityState === 'visible' && !welcome.classList.contains('hidden') && canvas.offsetParent !== null;
  const loop = (time) => {
    state.frame = 0;
    if (!visible()) { state.lastStep = 0; return; }
    if (!state.width && !fit()) return;
    if (!state.startedAt) state.startedAt = time;
    const gathering = state.progress !== state.to;
    if (gathering) {
      const part = clamp((time - state.startedAt) / state.duration);
      state.progress = state.from + (state.to - state.from) * part;
      if (part >= 1) {
        state.progress = state.to;
        if (state.to === 0) { state.from = 0; state.to = 1; state.startedAt = time; state.duration = ASSEMBLE_MS; }
      }
    }
    const due = !state.lastStep || time - state.lastStep >= FRAME_MS;
    if (due && !still.matches) {
      // After a long pause it carries on from where it was, without jumping forward.
      if (state.lastStep && !gathering) state.position = (state.position + 1) % HERO.frames;
      state.lastStep = time;
    }
    if (due || gathering) draw();
    if (!still.matches || state.progress !== state.to) state.frame = requestAnimationFrame(loop);
  };
  const wake = () => {
    if (state.frame || !visible()) return;
    state.frame = requestAnimationFrame(loop);
    if (still.matches) requestAnimationFrame(() => { if (fit()) draw(); });
  };
  canvas.addEventListener('click', () => {
    if (still.matches || state.to === 0) return;
    state.from = state.progress;
    state.to = 0;
    state.startedAt = 0;
    state.duration = SCATTER_MS;
    wake();
  });
  const resize = new ResizeObserver(() => { if (fit()) { draw(); wake(); } });
  const intersection = new IntersectionObserver(([entry]) => { state.onScreen = entry.isIntersecting; wake(); });
  const welcomeObserver = new MutationObserver(wake);
  const themeObserver = new MutationObserver(() => { if (state.width) draw(); });
  resize.observe(canvas);
  intersection.observe(canvas);
  welcomeObserver.observe(welcome, { attributes: true, attributeFilter: ['class'] });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const syncMotion = () => {
    if (still.matches) {
      if (state.frame) cancelAnimationFrame(state.frame);
      state.frame = 0; state.progress = 1; state.from = 1; state.to = 1;
      state.position = 0; state.lastStep = 0;
      if (fit()) draw();
    } else { state.lastStep = 0; wake(); }
  };
  still.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', wake);
  fetch(FRAMES_URL)
    .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
    .then((buffer) => {
      if (buffer.byteLength !== FRAME_BYTES * HERO.frames * 2) throw new Error('size');
      state.data = new Uint8Array(buffer);
      wake();
    })
    .catch(() => {
      // Without the frames the app's own logo comes back, so the welcome screen is never left with a hole.
      resize.disconnect(); intersection.disconnect(); welcomeObserver.disconnect(); themeObserver.disconnect();
      still.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', wake);
      if (state.frame) cancelAnimationFrame(state.frame);
      fallback();
    });
}
