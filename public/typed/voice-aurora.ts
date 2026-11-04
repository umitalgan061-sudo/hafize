// Northern lights behind the voice chat, as a trial the owner turns on in the voice settings. It is a layer of its own
// under the orange glow and the orb: the orb's code and look are not touched, and with the box unticked the screen is
// exactly as before. Curtains of light are drawn from smooth noise on a small canvas that the browser enlarges and
// blurs, so it costs little; it pauses whenever the voice screen is closed, and holds still for reduced motion.

const KEY = 'hafize.vm-aurora';
const SCALE = 6; // one canvas pixel per this many screen pixels
// Where the curtains lie, top to bottom, with their slant, waviness, drift and colour.
const CURTAINS: ReadonlyArray<{ y: number; slant: number; wave: number; speed: number; power: number; seed: number; colour: readonly [number, number, number] }> = [
  { y: 0.16, slant: -0.12, wave: 2.2, speed: 0.9, power: 1, seed: 11, colour: [70, 240, 150] },
  { y: 0.34, slant: 0.18, wave: 3.1, speed: 1.2, power: 0.85, seed: 23, colour: [60, 220, 210] },
  { y: 0.55, slant: -0.22, wave: 2.6, speed: 0.8, power: 0.7, seed: 37, colour: [150, 110, 255] },
  { y: 0.72, slant: 0.1, wave: 3.6, speed: 1.0, power: 0.65, seed: 41, colour: [90, 245, 140] },
  { y: 0.88, slant: -0.08, wave: 2.0, speed: 1.4, power: 0.55, seed: 53, colour: [230, 110, 200] }
];

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
    // Scattered curtains over the whole screen: each has its own height, slant, colour and drift, and breaks into
    // pieces along its length, so the light is spread about rather than one band across the top.
    const curtains = CURTAINS.map((curtain) => ({ ...curtain, base: curtain.y + 0.1 * (noise(curtain.seed, t * 0.5, 1) - 0.5) }));
    data.fill(0);
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const rays = 0.55 + 0.45 * noise(u * 24, t * 2.2, 9);
      const columns = curtains.map((curtain) => {
        const sway = curtain.base + curtain.slant * (u - 0.5) + 0.12 * (noise(u * curtain.wave + curtain.seed, t * curtain.speed, 2) - 0.5);
        // Where along its length a curtain shows: some stretches fade out, so the pieces lie apart.
        const piece = Math.max(0, noise(u * 2.6 + curtain.seed * 3, t * 0.6, 5) - 0.42) * 2.4;
        return { centre: sway, strength: piece * curtain.power, colour: curtain.colour };
      });
      for (let y = 0; y < height; y += 1) {
        const v = y / height;
        let r = 0; let g = 0; let b = 0; let a = 0;
        for (const column of columns) {
          if (!column.strength) continue;
          const d = v - column.centre;
          // A bright lower edge with light hanging upward from it, as aurora curtains do.
          const fall = d >= 0 ? Math.exp(-(d * d) / 0.0012) : Math.exp(-(d * d) / 0.012);
          const glow = fall * column.strength * rays;
          r += column.colour[0] * glow; g += column.colour[1] * glow; b += column.colour[2] * glow; a += glow;
        }
        if (!a) continue;
        const index = (y * width + x) * 4;
        data[index] = r / a; data[index + 1] = g / a; data[index + 2] = b / a;
        data[index + 3] = Math.min(1, a) * (light ? 120 : 210);
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
