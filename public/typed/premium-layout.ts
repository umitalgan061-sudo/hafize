// The finishing layer of the page's layout: a reading column for the chat on wide screens, drawn icons in the side
// menu in place of text glyphs, and a row of section links on top of the long Settings page.
//
// Nothing here changes what the page does. The menu items keep their words (other modules find them by their text),
// only the glyph in front is swapped for a drawing.

const STYLE_ID = 'hafizePremiumLayout';
/** The chat's reading width on a wide screen. Lines longer than this are tiring to read; tables scroll inside it. */
export const COLUMN_PX = 790;
const CSS = `
@media (min-width:900px){
  /* One column for the conversation, centred like the message box, instead of text running the full screen width. */
  .messages{padding-inline:max(0px,calc((100% - ${COLUMN_PX}px) / 2));scrollbar-gutter:stable}
  /* The status line starts where the answer's text starts. */
  .hz-dock{left:var(--hz-dock-left,12px)}
}
.nav-item,.new-chat{display:flex;align-items:center;gap:10px;text-align:left}
.hz-nav-ico{width:17px;height:17px;flex:none;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;opacity:.78}
.nav-item.active .hz-nav-ico,.nav-item[aria-current="page"] .hz-nav-ico,.new-chat .hz-nav-ico{opacity:1;color:var(--hz-orange,#dd7a52)}
/* Section links over Settings: the page is long, and this is the way around it. */
.hz-settings-index{position:sticky;top:var(--hz-top,0px);z-index:4;display:flex;gap:7px;overflow-x:auto;padding:10px 2px;margin:0 0 6px;scrollbar-width:none;background:linear-gradient(var(--bg,#f6f4ef) 72%,transparent);-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent)}
.hz-settings-index::-webkit-scrollbar{display:none}
.hz-settings-index button{flex:none;min-height:32px;padding:0 13px;border:1px solid var(--line,rgba(0,0,0,.12));border-radius:999px;background:var(--card,transparent);color:var(--text,inherit);font:inherit;font-size:12.5px;font-weight:550;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,transform .1s ease}
.hz-settings-index button:hover{border-color:color-mix(in srgb,var(--hz-orange,#dd7a52) 45%,transparent);background:color-mix(in srgb,var(--hz-orange,#dd7a52) 9%,transparent)}
.hz-settings-index button:active{transform:scale(.97)}
.hz-settings-index button:focus-visible{outline:2px solid var(--hz-orange,#dd7a52);outline-offset:2px}
.hz-settings-index button.is-here{border-color:transparent;background:var(--hz-orange,#dd7a52);color:#1f1408}
.settings-panel{scroll-margin-top:calc(var(--hz-top,0px) + 58px)}
/* A setting with its switch: the words on the left, the switch on the right, on a phone as well. */
.settings-workspace label.hz-account{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:7px 0}
.settings-workspace label.hz-account>span{flex:1;min-width:0}
.settings-workspace label.hz-account input[type=checkbox]{appearance:none;-webkit-appearance:none;flex:none;position:relative;width:40px;height:23px;margin:0;border-radius:999px;border:1px solid var(--line,rgba(0,0,0,.18));background:color-mix(in srgb,var(--text,#333) 14%,transparent);cursor:pointer;transition:background .18s ease,border-color .18s ease}
.settings-workspace label.hz-account input[type=checkbox]::after{content:"";position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.28);transition:transform .18s ease}
.settings-workspace label.hz-account input[type=checkbox]:checked{background:var(--hz-orange,#dd7a52);border-color:transparent}
.settings-workspace label.hz-account input[type=checkbox]:checked::after{transform:translateX(17px)}
.settings-workspace label.hz-account input[type=checkbox]:focus-visible{outline:2px solid var(--hz-orange,#dd7a52);outline-offset:2px}
.settings-workspace label.hz-account input[type=checkbox]:disabled{opacity:.5;cursor:default}
.task-results-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px}
.task-results-toolbar:empty{display:none}
@media (prefers-reduced-motion:reduce){.hz-settings-index button,.settings-workspace label.hz-account input[type=checkbox],.settings-workspace label.hz-account input[type=checkbox]::after{transition:none}}
`;

const SVG_NS = 'http://www.w3.org/2000/svg';
// 24x24 line drawings, one path each.
const ICONS: Record<string, string> = {
  yeni: 'M12 5v14M5 12h14',
  sohbet: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z',
  gorev: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  baglanti: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  ayar: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  proje: 'M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2.5h8.5A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z',
  tarayici: 'M3 12h18M12 3c2.6 2.6 4 5.7 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.7-4-9s1.4-6.4 4-9ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
};
const BY_WORD: Array<[RegExp, keyof typeof ICONS]> = [[/Yeni sohbet/i, 'yeni'], [/Sohbet/i, 'sohbet'], [/Görevler/i, 'gorev'], [/Bağlantılar/i, 'baglanti'], [/Ayarlar/i, 'ayar'], [/Projeler/i, 'proje'], [/Tarayıcı/i, 'tarayici']];

/** The words of a menu item without the glyph in front ("✦ Sohbet" is "Sohbet"), and which drawing goes with them. */
export function navLabel(text: string): { label: string; icon: string | null } {
  const label = text.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const found = BY_WORD.find(([word]) => word.test(label));
  return { label, icon: found ? found[1] : null };
}

function dressNavItem(item: HTMLElement): void {
  if (item.querySelector('.hz-nav-ico')) return;
  // Only an item that is plain text is touched; one that carries its own elements is left as it was built.
  if (item.children.length) return;
  const { label, icon } = navLabel(item.textContent ?? '');
  if (!icon || !label) return;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('hz-nav-ico');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[icon]);
  svg.append(path);
  const words = document.createElement('span');
  words.textContent = label;
  item.replaceChildren(svg, words);
}

function dressNav(): void {
  for (const item of document.querySelectorAll<HTMLElement>('.nav-item, .new-chat')) dressNavItem(item);
}

/** The status line above the message box is placed where the conversation's column starts. */
function alignDock(): void {
  const messages = document.getElementById('messages');
  const composer = document.querySelector<HTMLElement>('.composer');
  if (!messages || !composer) return;
  const measure = () => {
    const box = messages.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(messages).paddingLeft) || 0;
    const left = Math.round(box.left + pad - composer.getBoundingClientRect().left);
    composer.style.setProperty('--hz-dock-left', `${left}px`);
  };
  measure();
  new ResizeObserver(measure).observe(document.documentElement);
}

/** Section names of the Settings page, in order, without empty or repeated ones. */
export function sectionNames(titles: readonly string[]): string[] {
  const seen = new Set<string>();
  return titles.map((title) => title.trim()).filter((title) => title && !seen.has(title) && Boolean(seen.add(title)));
}

function settingsIndex(host: Element): void {
  let bar = host.querySelector<HTMLElement>(':scope > .hz-settings-index');
  const panels = [...host.querySelectorAll<HTMLElement>(':scope > .settings-panel, :scope > section')].filter((panel) => panel.querySelector('h2') && panel.offsetParent !== null);
  const names = sectionNames(panels.map((panel) => panel.querySelector('h2')?.textContent ?? ''));
  if (names.length < 3) { bar?.remove(); return; }
  if (bar && bar.dataset.names === names.join('|')) return;
  if (!bar) {
    bar = document.createElement('nav');
    bar.className = 'hz-settings-index';
    bar.setAttribute('aria-label', 'Ayarlar bölümleri');
    host.prepend(bar);
  }
  // The page scrolls under the top bar, so the links sit just below it.
  const top = document.querySelector('.topbar')?.getBoundingClientRect();
  (host as HTMLElement).style.setProperty('--hz-top', `${top && top.top <= 0 ? Math.round(top.bottom) : 0}px`);
  bar.dataset.names = names.join('|');
  bar.replaceChildren(...names.map((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.addEventListener('click', () => {
      const target = panels.find((panel) => panel.querySelector('h2')?.textContent?.trim() === name);
      target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      for (const other of bar!.children) other.classList.toggle('is-here', other === button);
    });
    return button;
  }));
}

function watchSettings(): void {
  let queued = false;
  const refresh = () => {
    queued = false;
    const host = document.querySelector('.settings-workspace');
    if (host) settingsIndex(host);
  };
  // A timer, not an animation frame: frames do not come while the page is in the background, and the bar must be
  // there when the owner comes back to it.
  const later = () => { if (!queued) { queued = true; setTimeout(refresh, 80); } };
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  later();
}

function install(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
  const start = () => {
    dressNav();
    // The Hafize layer adds its own menu items a little later.
    const list = document.querySelector('.nav-list') ?? document.querySelector('.sidebar');
    if (list) new MutationObserver(dressNav).observe(list, { childList: true, subtree: true });
    alignDock();
    watchSettings();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

install();
