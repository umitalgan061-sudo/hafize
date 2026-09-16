// Renders the Hafize brand mark into the PWA icon set.
//
// Not a check suite (run-checks only executes test-*/validate-*): this is run by
// hand whenever the brand mark changes, and the PNGs it writes are committed.
//
//   node scripts/generate-pwa-icons.mjs [path-to-chromium]
//
// It needs a Chromium/Chrome binary only to rasterize the same SVG mark the app
// already draws inline, so the icons cannot drift from the logo in index.html.
// Defaults to $CHROMIUM_BIN, then a Playwright install, then `chromium`/`google-chrome`.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DIR = path.join(ROOT, 'public');

const BACKGROUND = '#f7f5ef';
const MARK = '#3f6556';

// `padding` is the share of the canvas left empty around the mark. Maskable
// icons need the mark inside the safe zone, because launchers crop the edges.
const ICONS = [
  { file: 'icon-192.png', size: 192, padding: 0.12, background: BACKGROUND },
  { file: 'icon-512.png', size: 512, padding: 0.12, background: BACKGROUND },
  { file: 'icon-maskable-512.png', size: 512, padding: 0.22, background: BACKGROUND }
];

function petals() {
  // Same eight-petal flower the app renders in its header and welcome hero.
  return [
    '<ellipse cx="32" cy="19" rx="7" ry="15"/>',
    '<ellipse cx="32" cy="45" rx="7" ry="15"/>',
    '<ellipse cx="19" cy="32" rx="15" ry="7"/>',
    '<ellipse cx="45" cy="32" rx="15" ry="7"/>',
    '<ellipse cx="23" cy="23" rx="7" ry="15" transform="rotate(-45 23 23)"/>',
    '<ellipse cx="41" cy="41" rx="7" ry="15" transform="rotate(-45 41 41)"/>',
    '<ellipse cx="41" cy="23" rx="7" ry="15" transform="rotate(45 41 23)"/>',
    '<ellipse cx="23" cy="41" rx="7" ry="15" transform="rotate(45 23 41)"/>'
  ].join('');
}

function page({ size, padding, background }) {
  const inset = Math.round(size * padding);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:${background};}
  svg{position:absolute;left:${inset}px;top:${inset}px;width:${size - inset * 2}px;height:${size - inset * 2}px;}
  </style></head><body>
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="${MARK}" stroke-width="3.2">${petals()}</g></svg>
  </body></html>`;
}

function resolveChromium(explicit) {
  const candidates = [explicit, process.env.CHROMIUM_BIN].filter(Boolean);
  const playwright = '/opt/pw-browsers';
  if (existsSync(playwright)) {
    for (const entry of readdirSync(playwright)) {
      candidates.push(path.join(playwright, entry, 'chrome-linux', 'chrome'));
      candidates.push(path.join(playwright, entry, 'chrome-linux', 'headless_shell'));
    }
  }
  candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!found) throw new Error('CHROMIUM_NOT_FOUND: pass a browser path or set CHROMIUM_BIN');
  return found;
}

function render(browser, icon, workDir) {
  const htmlPath = path.join(workDir, `${icon.file}.html`);
  writeFileSync(htmlPath, page(icon), 'utf8');
  execFileSync(browser, [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--screenshot=${path.join(PUBLIC_DIR, icon.file)}`,
    `--window-size=${icon.size},${icon.size}`,
    `file://${htmlPath}`
  ], { stdio: 'ignore' });
}

const browser = resolveChromium(process.argv[2]);
const workDir = mkdtempSync(path.join(tmpdir(), 'hafize-icons-'));
try {
  for (const icon of ICONS) {
    render(browser, icon, workDir);
    console.log(`wrote public/${icon.file} (${icon.size}x${icon.size})`);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
