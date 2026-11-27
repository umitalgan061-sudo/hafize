/**
 * Hafize'nin Aynası — the owner-facing window of Hafize's mirror studio.
 *
 * Hafize imagines its own look and writes its shader on the server; this window
 * is Hafize's eyes: it compiles each candidate with the browser's WebGL, shows
 * it live, photographs all four states on both themes and hands that picture
 * back so Hafize can judge itself. When Hafize approves (or the owner presses
 * "Canlıya al"), the server ships it through GitHub and Render by itself.
 * Model text is always rendered with textContent.
 */
type Json = Record<string, any>;
type Candidate = { id: string; glsl: string; note: string; model: string; round: number; critique: Critique | null };
type Critique = { score: number; verdict: string; fixes: string[] };
type Stage = {
  ready: Promise<unknown>;
  current: () => { id: string; name: string; essence: string; renderer: string } | null;
  test: (glsl: string) => { ok: boolean; log: string };
  sheet: (glsl: string) => Promise<{ ok: boolean; dataUrl?: string; log?: string; metrics?: Json }>;
  mount: (host: HTMLElement, glsl: string, options?: Json) => { ok: boolean; log: string; setState: (s: string | null) => void; dispose: () => void };
  preview: (glsl: string) => { ok: boolean; log: string };
  reset: () => void;
};

const PUBLISH_KEY = 'hafize.mirror.publish.v1';
const PHASES: Record<string, (d: Json) => string> = {
  queued: () => 'Sıraya alındı',
  imagining: () => 'Kendini hayal ediyor…',
  'imagining-retry': (d) => 'Fikri okunamadı (' + String(d.model || '').split('/').pop() + (d.chars !== undefined ? ', ' + d.chars + ' karakter' : '') + (d.finish ? ', ' + d.finish : '') + (d.error ? ', ' + d.error : '') + '); yeniden düşünüyor…',
  imagined: (d) => 'Kendini hayal etti: “' + (d.name || '') + '”',
  coding: () => 'Kendi kodunu yazıyor…',
  'coding-retry': (d) => 'Taslak kurallara uymadı (' + (Array.isArray(d.errors) ? d.errors.join('; ') : '') + '); yeniden yazıyor…',
  coded: () => 'Kodu hazır',
  repairing: () => 'Derleyicinin söylediğini düzeltiyor…',
  reflecting: () => 'Aynada kendine bakıyor…',
  reflected: (d) => d.unavailable ? 'Ölçümler iyi; görsel model yanıt vermedi' : d.measured ? 'Ölçümlere göre kendine ' + d.score + '/10 verdi' : 'Aynada kendine ' + d.score + '/10 verdi',
  revising: () => 'Gördüğüne göre kendini düzeltiyor…',
  branch: () => 'GitHub’da kendi dalını açıyor…',
  commit: () => 'Portresini commit’liyor…',
  pull: () => 'PR açıyor…',
  ci: (d) => 'PR #' + d.number + ' açıldı; testler çalışıyor…',
  'updating-branch': () => 'Ana dal ilerlemiş; dalını güncelliyor…',
  merged: (d) => 'PR #' + d.number + ' birleştirildi; ana dal testleri bekleniyor…',
  deploying: () => 'Testler geçti; yayına gönderiyor…',
  'deploy-requested': (d) => d.deploy === 'scheduled' ? 'Birleştirildi; bir sonraki planlı yayında (08:17 / 20:17) canlıya çıkacak' : 'Render’a gönderildi',
  done: () => 'Tamam'
};
const ERRORS: Record<string, string> = {
  SELF_PORTRAIT_OWNER_REQUIRED: 'Ayna yalnızca hesap sahibine açık. Hafize’de oturum açtığından emin ol.',
  NVIDIA_NOT_CONFIGURED: 'Sunucuda model anahtarı yapılandırılmamış.',
  SELF_PORTRAIT_BUSY: 'Hafize zaten aynada bir şey yapıyor; biraz bekle.',
  SELF_PORTRAIT_PUBLISH_BUSY: 'Bir yayın zaten sürüyor.',
  SELF_PORTRAIT_PUBLISH_UNAVAILABLE: 'Sunucuda GitHub yayın yetkisi yok; yalnız önizleme yapılabilir.',
  SELF_PORTRAIT_CONCEPT_UNREADABLE: 'Hafize’nin fikri okunamadı; yeniden dene.',
  SELF_PORTRAIT_CODE_INVALID: 'Hafize kurallara uyan kod üretemedi; yeniden dene.',
  SELF_PORTRAIT_CI_FAILED: 'PR testleri geçmedi; yayın durdu.',
  SELF_PORTRAIT_TIMEOUT: 'Zaman aşımı; yeniden dene.',
  SELF_PORTRAIT_SESSION_NOT_FOUND: 'Sunucu yeniden başladığı için bu oturum kapandı; yeniden başlat.'
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
};
const stage = () => (globalThis as typeof globalThis & { HafizePortrait?: Stage }).HafizePortrait ?? null;
const apiFetch = (input: string, init?: RequestInit) => {
  const auth = (globalThis as typeof globalThis & { HafizeAuth?: { fetch: typeof fetch } }).HafizeAuth;
  return (auth?.fetch ?? fetch)(input, init);
};

class MirrorError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

async function api(path: string, body?: Json): Promise<Json> {
  const response = await apiFetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) } : { headers: { Accept: 'application/json' }, cache: 'no-store' });
  let data: Json = {};
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) throw new MirrorError(typeof data.error === 'string' ? data.error : 'HTTP_' + response.status);
  return data;
}

function install() {
  const card = document.querySelector<HTMLElement>('.main .utility-rail .voice-card');
  const head = card?.querySelector<HTMLElement>('.utility-head');
  if (!card || !head || head.querySelector('.hz-mirror-open')) return;
  const button = make('button', 'hz-mirror-open', 'Ayna');
  button.type = 'button';
  button.title = 'Hafize’nin aynası: kendi görünüşünü kendisi tasarlasın';
  button.setAttribute('aria-label', 'Hafize’nin aynası');
  button.addEventListener('click', () => { void openMirror(); });
  head.append(button);
}

let openDialog: HTMLDialogElement | null = null;

async function openMirror() {
  if (openDialog) { openDialog.showModal(); return; }
  const portrait = stage();
  const dialog = make('dialog', 'hz-mirror');
  dialog.setAttribute('aria-labelledby', 'hzMirrorTitle');
  const top = make('div', 'hz-mirror-top');
  const title = make('h2', 'hz-mirror-title', 'Hafize’nin Aynası');
  title.id = 'hzMirrorTitle';
  const close = make('button', 'hz-mirror-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Kapat');
  top.append(title, close);
  const intro = make('p', 'hz-mirror-intro', 'Burada Hafize nasıl görüneceğine kendisi karar verir: kendini hayal eder, kendi kodunu yazar, aynada kendine bakar, beğenmezse düzeltir ve beğendiğinde kendisi GitHub’a gönderip canlıya alır.');
  const live = make('p', 'hz-mirror-live');
  const body = make('div', 'hz-mirror-body');
  const stageBox = make('div', 'hz-mirror-stage');
  const stageHost = make('div', 'hz-mirror-canvas');
  const placeholder = make('div', 'hz-mirror-placeholder', 'Ayna boş. Hafize henüz kendine bakmadı.');
  stageHost.append(placeholder);
  const chips = make('div', 'hz-mirror-chips');
  const chipStates: [string, string][] = [['auto', 'Otomatik'], ['idle', 'Boşta'], ['listening', 'Dinliyor'], ['thinking', 'Düşünüyor'], ['speaking', 'Konuşuyor']];
  const chipButtons = chipStates.map(([state, label]) => {
    const chip = make('button', 'hz-mirror-chip', label);
    chip.type = 'button';
    chip.dataset.state = state;
    chip.setAttribute('aria-pressed', String(state === 'auto'));
    chips.append(chip);
    return chip;
  });
  stageBox.append(stageHost, chips);
  const side = make('div', 'hz-mirror-side');
  const concept = make('section', 'hz-mirror-concept');
  concept.hidden = true;
  const log = make('ol', 'hz-mirror-log');
  log.setAttribute('aria-live', 'polite');
  const progressLine = make('p', 'hz-mirror-progress');
  side.append(concept, log, progressLine);
  body.append(stageBox, side);
  const actions = make('div', 'hz-mirror-actions');
  const autoLabel = make('label', 'hz-mirror-auto');
  const auto = make('input');
  auto.type = 'checkbox';
  auto.checked = true;
  autoLabel.append(auto, document.createTextNode(' Beğendiğinde kendisi canlıya alsın'));
  const start = make('button', 'hz-mirror-btn is-main', 'Hafize kendini tasarlasın');
  start.type = 'button';
  const again = make('button', 'hz-mirror-btn', 'Yeniden hayal et');
  again.type = 'button';
  again.hidden = true;
  const ship = make('button', 'hz-mirror-btn', 'Canlıya al');
  ship.type = 'button';
  ship.hidden = true;
  actions.append(autoLabel, again, ship, start);
  dialog.append(top, intro, live, body, actions);
  document.body.append(dialog);
  openDialog = dialog;

  let view: ReturnType<Stage['mount']> | null = null;
  let session = '';
  let chosen: Candidate | null = null;
  const known = new Map<string, Candidate>();
  let busy = false;
  let fixedState: string | null = null;

  const note = (text: string, tone = '') => {
    const item = make('li', tone ? 'is-' + tone : '');
    const time = make('time', '', new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    item.append(time, document.createTextNode(' ' + text));
    log.append(item);
    log.scrollTop = log.scrollHeight;
  };
  const showLive = () => {
    const current = portrait?.current();
    live.textContent = current ? 'Şu an yayında: “' + current.name + '” — ' + current.essence : 'Henüz Hafize’nin kendi seçtiği bir görünüş yayında değil.';
  };
  const show = (candidate: Candidate) => {
    if (!portrait) return { ok: false, log: 'STAGE_MISSING' };
    view?.dispose();
    placeholder.remove();
    view = portrait.mount(stageHost, candidate.glsl, { className: 'hz-mirror-gl' });
    view.setState(fixedState);
    portrait.preview(candidate.glsl);
    return view;
  };
  const showConcept = (c: Json) => {
    concept.replaceChildren();
    concept.hidden = false;
    concept.append(make('h3', 'hz-mirror-name', c.name || ''));
    concept.append(make('blockquote', 'hz-mirror-essence', c.essence || ''));
    if (Array.isArray(c.palette) && c.palette.length) {
      const swatches = make('div', 'hz-mirror-palette');
      for (const color of c.palette) {
        if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) continue;
        const swatch = make('span', 'hz-mirror-swatch');
        swatch.style.background = color;
        swatch.title = color;
        swatches.append(swatch);
      }
      concept.append(swatches);
    }
    const details = make('details', 'hz-mirror-details');
    details.append(make('summary', '', 'Hafize’nin tarifi'));
    if (c.why) details.append(make('p', '', 'Neden: ' + c.why));
    details.append(make('p', '', c.form || ''));
    const states = c.states || {};
    for (const [key, label] of [['idle', 'Boşta'], ['listening', 'Dinliyor'], ['thinking', 'Düşünüyor'], ['speaking', 'Konuşuyor']]) {
      if (states[key]) details.append(make('p', '', label + ': ' + states[key]));
    }
    concept.append(details);
  };

  async function job(bodyJson: Json, interval = 1500): Promise<Json> {
    let snap = await api('/api/self-portrait/jobs', bodyJson);
    let seen = 0;
    for (;;) {
      const entries = Array.isArray(snap.log) ? snap.log : [];
      for (const entry of entries.slice(seen)) {
        const text = PHASES[entry.phase]?.(entry.detail || {});
        if (text) note(text);
      }
      seen = entries.length;
      const chars = Number(snap.progress?.chars);
      progressLine.textContent = snap.status === 'running' && Number.isFinite(chars) && ['coding', 'repairing', 'revising', 'coding-retry'].includes(snap.phase)
        ? (chars > 0 ? 'Hafize kodunu yazıyor: ' + chars.toLocaleString('tr-TR') + ' karakter' : 'Hafize yazmadan önce düşünüyor…') : '';
      if (snap.status === 'done') { progressLine.textContent = ''; return snap.result || {}; }
      if (snap.status === 'failed') { progressLine.textContent = ''; throw new MirrorError(snap.error || 'SELF_PORTRAIT_FAILED'); }
      await sleep(interval);
      snap = await api('/api/self-portrait/jobs/' + snap.id);
    }
  }

  async function compileOrRepair(candidate: Candidate): Promise<Candidate | null> {
    let current = candidate;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = portrait!.test(current.glsl);
      if (result.ok) return current;
      if (result.log === 'WEBGL_UNAVAILABLE') { note('Bu tarayıcıda WebGL yok; ayna çalışamıyor.', 'error'); return null; }
      if (attempt === 3) break;
      note('Tarayıcı derleyicisi kodu kabul etmedi; hatayı Hafize’ye gösteriyorum.', 'warn');
      const out = await job({ action: 'repair', session, candidate: current.id, compileLog: result.log });
      current = out.candidate;
    }
    note('Hafize bu kez kodunu derletemedi. “Yeniden hayal et” ile tekrar deneyebilirsin.', 'error');
    return null;
  }

  async function design(reimagine: boolean) {
    if (busy || !portrait) return;
    busy = true;
    start.disabled = true; again.disabled = true; ship.hidden = true; chosen = null;
    try {
      const first = await job({ action: 'imagine', ...(reimagine && session ? { session } : {}) });
      session = first.session;
      showConcept(first.concept);
      const coded = await job({ action: 'code', session }, 2000);
      note('Fikir modeli: ' + (first.concept?.model || '—') + ' · kod modeli: ' + (coded.candidate?.model || '—'));
      let candidate: Candidate | null = coded.candidate;
      while (candidate) {
        candidate = await compileOrRepair(candidate);
        if (!candidate) break;
        known.set(candidate.id, candidate);
        show(candidate);
        note('Derlendi; aynada canlı.', 'ok');
        const photo = await portrait.sheet(candidate.glsl);
        if (!photo.ok || !photo.dataUrl) { note('Ayna fotoğrafı çekilemedi: ' + (photo.log || ''), 'error'); break; }
        const seen = await job({ action: 'reflect', session, candidate: candidate.id, sheet: photo.dataUrl, metrics: photo.metrics }, 2000);
        if (seen.visionUnavailable) {
          const tried = Array.isArray(seen.visionAttempts) ? seen.visionAttempts.map((a: Json) => String(a.model).split('/').pop() + ' → ' + a.outcome).join(', ') : '';
          note('Görsel modeller yanıt vermedi' + (tried ? ' (' + tried + ')' : '') + '; Hafize tarayıcının ölçümleriyle kendine bakıyor.', 'warn');
        }
        if (seen.critique) {
          note('“' + seen.critique.verdict + '”', seen.approved ? 'ok' : '');
          for (const fix of seen.critique.fixes || []) note('→ ' + fix);
        }
        if (seen.approved) { chosen = candidate; break; }
        if (seen.exhausted) {
          chosen = known.get(seen.best) ?? candidate;
          show(chosen);
          note('Dört bakıştan sonra en iyi hâlini seçti.');
          break;
        }
        candidate = seen.candidate ?? null;
        if (candidate) note('Yeni hâli hazır; tekrar bakıyor.');
      }
      if (chosen) {
        ship.hidden = false;
        note('Hafize bu görünüşü seçti.', 'ok');
        if (auto.checked) await publish();
      }
    } catch (error) {
      const code = error instanceof MirrorError ? error.code : 'SELF_PORTRAIT_FAILED';
      note(ERRORS[code] ?? 'Bir şey ters gitti (' + code + ').', 'error');
    } finally {
      busy = false;
      start.disabled = false; again.disabled = false;
      again.hidden = !session;
      start.textContent = session ? 'Baştan başlat' : 'Hafize kendini tasarlasın';
    }
  }

  async function watchLive(portraitId: string) {
    const until = Date.now() + 25 * 60 * 1000;
    note('Canlı sürüm bekleniyor (birkaç dakika sürebilir)…');
    while (Date.now() < until) {
      await sleep(20_000);
      try {
        const response = await fetch('/hafize-self-portrait.json', { cache: 'no-store' });
        const doc = response.ok ? await response.json() : null;
        if (doc?.id === portraitId) {
          note('Canlıda! Hafize artık kendi seçtiği görünüşle. Sayfayı yenileyince ana ekranda görünecek.', 'ok');
          try { localStorage.removeItem(PUBLISH_KEY); } catch { /* storage may be unavailable */ }
          return;
        }
      } catch { /* server restarting during the deploy */ }
    }
    note('Canlı sürüm henüz görünmüyor; GitHub Actions’taki yayını kontrol edebilirsin.', 'warn');
  }

  async function publish() {
    if (!chosen) return;
    ship.disabled = true;
    note('Hafize kendini canlıya alıyor: dal, commit, PR, testler, birleştirme ve yayın. Pencereyi kapatsan da sunucuda devam eder.');
    try {
      const out = await job({ action: 'publish', session, candidate: chosen.id }, 5000);
      if (out.url) note('PR: ' + out.url, 'ok');
      try { localStorage.setItem(PUBLISH_KEY, JSON.stringify({ portrait: out.portrait, at: Date.now() })); } catch { /* optional */ }
      if (out.deploy !== 'scheduled') await watchLive(String(out.portrait || ''));
    } catch (error) {
      const code = error instanceof MirrorError ? error.code : 'SELF_PORTRAIT_FAILED';
      // The deploy restarts the server; a lost job after the merge is expected.
      if (code === 'SELF_PORTRAIT_JOB_NOT_FOUND' || code === 'HTTP_502' || code === 'HTTP_503') note('Sunucu yeniden başlıyor (yayın sürüyor olabilir).', 'warn');
      else note(ERRORS[code] ?? 'Yayın durdu (' + code + ').', 'error');
    } finally {
      ship.disabled = false;
    }
  }

  chipButtons.forEach((chip) => chip.addEventListener('click', () => {
    fixedState = chip.dataset.state === 'auto' ? null : chip.dataset.state || null;
    chipButtons.forEach((other) => other.setAttribute('aria-pressed', String(other === chip)));
    view?.setState(fixedState);
  }));
  start.addEventListener('click', () => { void design(false); });
  again.addEventListener('click', () => { void design(true); });
  ship.addEventListener('click', () => { void publish(); });
  const closeMirror = () => { dialog.close(); };
  close.addEventListener('click', closeMirror);
  dialog.addEventListener('close', () => { if (!busy) portrait?.reset(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) closeMirror(); });

  if (!portrait) note('Ayna sahnesi yüklenemedi.', 'error');
  await portrait?.ready;
  showLive();
  try {
    const status = await api('/api/self-portrait/status');
    if (!status.publishAvailable) { auto.checked = false; autoLabel.hidden = true; note('Bu sunucuda yayın yetkisi yok; Hafize yalnız önizleme yapabilir.', 'warn'); }
  } catch (error) {
    const code = error instanceof MirrorError ? error.code : '';
    note(ERRORS[code] ?? 'Ayna şu an kullanılamıyor (' + code + ').', 'error');
    start.disabled = true;
  }
  try {
    const pending = JSON.parse(localStorage.getItem(PUBLISH_KEY) || 'null');
    if (pending?.portrait && Date.now() - Number(pending.at) < 60 * 60 * 1000 && portrait?.current()?.id !== pending.portrait) void watchLive(String(pending.portrait));
  } catch { /* optional */ }
  dialog.showModal();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();

export { openMirror };
