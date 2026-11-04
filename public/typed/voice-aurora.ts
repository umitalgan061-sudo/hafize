// Northern lights behind the voice chat, as a trial the owner turns on in the voice settings. It is a layer of its own
// under the orange glow and the orb: the orb's code and look are not touched, and with the box unticked the screen is
// exactly as before. Curtains of light are drawn from smooth noise on a small canvas that the browser enlarges and
// blurs, so it costs little; it pauses whenever the voice screen is closed, and holds still for reduced motion.

const KEY = 'hafize.vm-aurora';
const SCALE = 6; // one canvas pixel per this many screen pixels

const on = (): boolean => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } };
const setOn = (value: boolean): void => { try { localStorage.setItem(KEY, value ? 'on' : 'off'); } catch { /* private mode */ } };

/** Smooth value noise over a seeded lattice: 0..1, continuous in x, y and time. */
function makeNoise(seed: number): (x: number, y: number, z: number) => number {
  const table = new Float32Array(4096);
  let state = seed >>> 0;
  for (let index = 0; index < table.length; index += 1) {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) + 0x9e3779b9) >>> 0;
    table[index] = (state >>> 8) / 16777216;
  }
  const at = (x: number, y: number, z: number): number => table[((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 4095] ?? 0;
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
    const plane = (k: number): number => mix(mix(at(xi, yi, k), at(xi + 1, yi, k), xf), mix(at(xi, yi + 1, k), at(xi + 1, yi + 1, k), xf), yf);
    return mix(plane(zi), plane(zi + 1), zf);
  };
}

function attach(screen: HTMLElement): void {
  if (screen.querySelector('.vm-aurora')) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'vm-aurora';
  canvas.setAttribute('aria-hidden', 'true');
  screen.prepend(canvas);
  const draw = canvas.getContext('2d');
  if (!draw) return;
  const noise = makeNoise(7);
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let image: ImageData | null = null;

  const paint = (seconds: number): void => {
    const width = Math.max(32, Math.round(screen.clientWidth / SCALE));
    const height = Math.max(24, Math.round(screen.clientHeight / SCALE));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; image = null; }
    image ??= draw.createImageData(width, height);
    const data = image.data;
    const light = document.documentElement.dataset.theme === 'light';
    const t = seconds * 0.06;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      // Each column has its curtain's height, its brightness and fine vertical rays, all drifting slowly.
      // Two curtains, each with its own height, brightness and fine vertical rays, all drifting slowly.
      const centre = 0.32 + 0.18 * (noise(u * 2.2, t, 0) - 0.5) + 0.08 * (noise(u * 5, t * 1.7, 3) - 0.5);
      const strength = 0.35 + 0.95 * noise(u * 1.6, t * 0.8, 6);
      const second = 0.2 + 0.14 * (noise(u * 1.8, t * 0.7, 12) - 0.5);
      const secondStrength = 0.2 + 0.7 * noise(u * 2.4, t * 0.9, 15);
      const rays = 0.6 + 0.4 * noise(u * 26, t * 2.4, 9);
      for (let y = 0; y < height; y += 1) {
        const v = y / height;
        const below = v - centre;
        const belowSecond = v - second;
        // Light hangs from a bright lower edge and fades slowly upward, as aurora curtains do.
        const curtain = (d: number): number => (d >= 0 ? Math.exp(-(d * d) / 0.003) : Math.exp(-(d * d) / 0.05));
        const glow = Math.min(1, (curtain(below) * strength + curtain(belowSecond) * secondStrength * 0.7) * rays);
        const top = Math.min(1, Math.max(0, -below * 3.2));
        const index = (y * width + x) * 4;
        data[index] = 40 + 120 * top;
        data[index + 1] = 235 - 120 * top;
        data[index + 2] = 150 + 100 * top;
        data[index + 3] = glow * (light ? 120 : 220);
      }
    }
    draw.putImageData(image, 0, 0);
  };

  const loop = (time: number): void => {
    frame = 0;
    if (screen.hidden || !on()) return;
    paint(time / 1000);
    if (!reduce?.matches) frame = requestAnimationFrame(loop);
  };
  const sync = (): void => {
    canvas.hidden = !on();
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!screen.hidden && on()) frame = requestAnimationFrame(loop);
  };
  new MutationObserver(sync).observe(screen, { attributes: true, attributeFilter: ['hidden'] });

  // The switch sits with the other voice settings.
  const settings = screen.querySelector('.vm-settings');
  if (settings && !settings.querySelector('.vm-aurora-toggle')) {
    const label = document.createElement('label');
    label.className = 'vm-field vm-aurora-toggle';
    const text = document.createElement('span');
    text.textContent = 'Kuzey ışıkları arka planı (deneme)';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = on();
    box.addEventListener('change', () => { setOn(box.checked); sync(); });
    label.append(text, box);
    settings.append(label);
  }
  sync();
}

// The voice screen is made when it is first needed; it is picked up whenever it appears.
const look = (): void => { const screen = document.querySelector<HTMLElement>('.voice-mode'); if (screen) attach(screen); };
look();
new MutationObserver(look).observe(document.body, { childList: true });
