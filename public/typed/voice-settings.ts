// "Sesler" panel on the Settings page: choose the voice Hafize speaks with, from the voices this
// browser offers and from the downloadable Piper library. Selecting a voice writes the same keys
// voice-output.ts reads, so replies, "Seslendir" and the voice chat screen all follow it.

import { PIPER_PREFIX, SPEAKER_KEY, canStoreVoices, downloadVoice, downloadedKeys, filterVoices, formatSize, isPiperVoice, loadCatalog, removeVoice, sampleFor, type PiperVoice } from './voice-library.ts';

const VOICE_KEY = 'hafize.voiceOutput.voice.v1';
const RATE_KEY = 'hafize.voiceOutput.rate.v1';
const SPEAK_EVENT = 'hafize:voice-output-speak';
const STOP_EVENT = 'hafize:voice-output-stop';
const STATE_EVENT = 'hafize:voice-output-state';
const PAGE_SIZE = 40;
const QUALITY: Record<string, string> = { x_low: 'çok düşük', low: 'düşük', medium: 'orta', high: 'yüksek' };

/** Languages for the filter: most voices first, Turkish always on top. */
export function languageOptions(voices: readonly PiperVoice[]): Array<{ family: string; label: string; count: number }> {
  const families = new Map<string, { family: string; label: string; count: number }>();
  for (const voice of voices) {
    const entry = families.get(voice.family);
    if (entry) entry.count += 1;
    else families.set(voice.family, { family: voice.family, label: voice.langName, count: 1 });
  }
  return [...families.values()].sort((a, b) => Number(b.family === 'tr') - Number(a.family === 'tr') || b.count - a.count || a.label.localeCompare(b.label, 'tr'));
}

export function describeVoice(voice: PiperVoice): string {
  const parts = [`${voice.langName} (${voice.country})`, `${QUALITY[voice.quality] || voice.quality} kalite`, formatSize(voice.size)];
  if (voice.speakers > 1) parts.push(`${voice.speakers} konuşmacı`);
  return parts.join(' · ');
}

export function installVoiceSettings(documentRef: Document, host: Element, root: typeof globalThis = globalThis): (() => void) | null {
  if (host.querySelector('.voice-library')) return null;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const storage = (() => { try { return root.localStorage; } catch { return null; } })();
  const read = (key: string) => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
  const write = (key: string, value: string | null) => { try { if (value == null) storage?.removeItem(key); else storage?.setItem(key, value); } catch { /* private mode */ } };

  const panel = el('section', 'settings-panel voice-library');
  panel.append(el('h2', '', 'Sesler'), el('p', '', 'Hafize\'nin hangi sesle konuşacağını seç. Seçimin sesli yanıtlarda, Seslendir düğmesinde ve sesli sohbette kullanılır.'));

  const currentRow = el('div', 'voice-current');
  const currentLabel = el('span', 'voice-current-label');
  const rateLabel = el('label', 'voice-rate');
  const rateText = el('span');
  const rateInput = el('input');
  rateInput.type = 'range'; rateInput.min = '0.7'; rateInput.max = '1.5'; rateInput.step = '0.05';
  rateInput.setAttribute('aria-label', 'Konuşma hızı');
  rateLabel.append(rateText, rateInput);
  currentRow.append(currentLabel, rateLabel);

  const deviceTitle = el('h3', 'voice-group-title', 'Bu cihazdaki sesler');
  const deviceHint = el('p', 'voice-hint', 'İndirme gerektirmez. Çeşidi tarayıcına ve Windows dil paketlerine bağlıdır.');
  const deviceList = el('ul', 'voice-list');

  const libraryTitle = el('h3', 'voice-group-title', 'Ses kütüphanesi (Piper)');
  const libraryHint = el('p', 'voice-hint', 'Ücretsiz, indirilince internetsiz çalışır; metnin bu tarayıcıdan çıkmaz. Yalnızca "İndir" dediğinde Hugging Face\'ten iner. Her ses kendi dilinde doğru okur; Türkçe metin için Türkçe ses seç.');
  const filters = el('div', 'voice-filters');
  const familySelect = el('select');
  familySelect.setAttribute('aria-label', 'Dil');
  const search = el('input');
  search.type = 'search'; search.placeholder = 'Ses veya dil ara'; search.setAttribute('aria-label', 'Ses ara');
  filters.append(familySelect, search);
  const libraryList = el('ul', 'voice-list');
  const more = el('button', 'voice-more', 'Daha fazla göster');
  more.type = 'button';
  const status = el('p', 'voice-status');
  status.setAttribute('role', 'status');
  panel.append(currentRow, deviceTitle, deviceHint, deviceList, libraryTitle, libraryHint, filters, libraryList, more, status);

  // After "Görünüm", so it is near the top of the page.
  const first = host.querySelector('.settings-panel');
  if (first?.nextSibling) host.insertBefore(panel, first.nextSibling); else host.append(panel);

  let catalog: PiperVoice[] = [];
  let owned = new Set<string>();
  let visible = PAGE_SIZE;
  let previewing = '';
  const downloads = new Map<string, { controller: AbortController; fraction: number }>();
  const listeners: Array<() => void> = [];
  const on = (target: EventTarget, type: string, fn: EventListener) => { target.addEventListener(type, fn); listeners.push(() => target.removeEventListener(type, fn)); };

  const browserVoices = () => { try { return root.speechSynthesis?.getVoices?.() ?? []; } catch { return []; } };
  const chosen = () => read(VOICE_KEY) || '';
  const say = (message: string) => { status.textContent = message; };

  const nameOf = (id: string) => {
    if (!id) return 'Otomatik (en doğal Türkçe ses)';
    if (isPiperVoice(id)) return catalog.find((voice) => `${PIPER_PREFIX}${voice.key}` === id)?.name ?? 'İndirilen ses';
    return browserVoices().find((voice) => voice.voiceURI === id)?.name ?? 'Seçili ses';
  };
  const renderCurrent = () => {
    currentLabel.textContent = `Şu anki ses: ${nameOf(chosen())}`;
    const value = Number(read(RATE_KEY));
    const rate = Number.isFinite(value) && value >= 0.7 && value <= 1.5 ? value : 1;
    rateInput.value = String(rate);
    rateText.textContent = `Hız ${rate.toFixed(2)}×`;
  };
  const button = (label: string, onClick: () => void, className = '') => {
    const node = el('button', className, label);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  };
  const preview = (id: string, sample: string) => {
    if (previewing === id) { documentRef.dispatchEvent(new CustomEvent(STOP_EVENT)); return; }
    documentRef.dispatchEvent(new CustomEvent(SPEAK_EVENT, { detail: { text: sample, origin: `voice-preview:${id}`, voice: id } }));
  };
  const select = (id: string) => {
    write(VOICE_KEY, id || null);
    write(SPEAKER_KEY, null);
    render();
    say(`${nameOf(id)} seçildi.`);
  };
  const row = (title: string, detail: string, active: boolean) => {
    const item = el('li', active ? 'voice-row is-selected' : 'voice-row');
    const copy = el('div', 'voice-copy');
    copy.append(el('strong', '', title), el('small', '', detail));
    const actions = el('div', 'voice-actions');
    item.append(copy, actions);
    return { item, actions };
  };
  const previewLabel = (id: string) => (previewing === id ? '■ Durdur' : '▶ Dinle');

  const renderDevice = () => {
    const voices = browserVoices();
    const turkish = voices.filter((voice) => voice.lang.toLowerCase().startsWith('tr'));
    const others = voices.filter((voice) => !voice.lang.toLowerCase().startsWith('tr'));
    deviceList.replaceChildren();
    const auto = row('Otomatik', 'Bu cihazdaki en doğal Türkçe sesi kullanır', !chosen());
    if (chosen()) auto.actions.append(button('Seç', () => select('')));
    else auto.actions.append(el('span', 'voice-badge', 'Seçili'));
    deviceList.append(auto.item);
    for (const voice of [...turkish, ...others]) {
      const entry = row(voice.name.replace(/^Microsoft\s+/i, ''), `${voice.lang}${voice.localService ? '' : ' · çevrimiçi'}`, chosen() === voice.voiceURI);
      entry.actions.append(button(previewLabel(voice.voiceURI), () => preview(voice.voiceURI, sampleFor(voice.lang.slice(0, 2).toLowerCase()))));
      if (chosen() === voice.voiceURI) entry.actions.append(el('span', 'voice-badge', 'Seçili'));
      else entry.actions.append(button('Seç', () => select(voice.voiceURI)));
      deviceList.append(entry.item);
    }
  };

  const renderLibrary = () => {
    const matches = filterVoices(catalog, familySelect.value, search.value);
    libraryList.replaceChildren();
    for (const voice of matches.slice(0, visible)) {
      const id = `${PIPER_PREFIX}${voice.key}`;
      const active = chosen() === id;
      const entry = row(voice.name, describeVoice(voice), active);
      const download = downloads.get(voice.key);
      if (download) {
        const bar = el('progress', 'voice-progress');
        bar.max = 1;
        bar.value = download.fraction;
        bar.setAttribute('aria-label', `${voice.name} indiriliyor`);
        entry.actions.append(bar, button('İptal', () => download.controller.abort()));
      } else if (owned.has(voice.key)) {
        entry.actions.append(button(previewLabel(id), () => preview(id, sampleFor(voice.family))));
        if (active) entry.actions.append(el('span', 'voice-badge', 'Seçili'));
        else entry.actions.append(button('Seç', () => select(id)));
        entry.actions.append(button('Sil', () => { void remove(voice); }, 'voice-remove'));
        if (active && voice.speakers > 1) entry.actions.prepend(speakerPicker(voice));
      } else {
        entry.actions.append(button(`İndir · ${formatSize(voice.size)}`, () => { void download_(voice); }, 'voice-download'));
      }
      libraryList.append(entry.item);
    }
    if (!matches.length) libraryList.append(el('li', 'voice-empty', 'Bu aramayla eşleşen ses yok.'));
    more.hidden = matches.length <= visible;
  };
  const speakerPicker = (voice: PiperVoice) => {
    const picker = el('select', 'voice-speaker');
    picker.setAttribute('aria-label', 'Konuşmacı');
    for (let i = 0; i < voice.speakers; i += 1) { const option = el('option', '', `Konuşmacı ${i + 1}`); option.value = String(i); picker.append(option); }
    picker.value = read(SPEAKER_KEY) || '0';
    picker.addEventListener('change', () => write(SPEAKER_KEY, picker.value));
    return picker;
  };
  const render = () => { renderCurrent(); renderDevice(); renderLibrary(); };

  const download_ = async (voice: PiperVoice) => {
    const controller = new AbortController();
    const state = { controller, fraction: 0 };
    downloads.set(voice.key, state);
    renderLibrary();
    let painted = 0;
    try {
      await downloadVoice(voice, (fraction) => {
        state.fraction = fraction;
        // Only the progress bar moves; rebuilding the list on every chunk would be wasteful.
        if (fraction - painted >= 0.02) { painted = fraction; renderLibrary(); }
      }, controller.signal);
      owned.add(voice.key);
      say(`${voice.name} indirildi. Dinleyip seçebilirsin.`);
    } catch (error) {
      say((error as Error).name === 'AbortError' ? 'İndirme iptal edildi.' : `${voice.name} indirilemedi. İnternet bağlantını kontrol edip yeniden dene.`);
    } finally {
      downloads.delete(voice.key);
      renderLibrary();
    }
  };
  const remove = async (voice: PiperVoice) => {
    await removeVoice(voice);
    owned.delete(voice.key);
    if (chosen() === `${PIPER_PREFIX}${voice.key}`) { write(VOICE_KEY, null); write(SPEAKER_KEY, null); }
    render();
    say(`${voice.name} silindi.`);
  };

  on(familySelect, 'change', () => { visible = PAGE_SIZE; renderLibrary(); });
  on(search, 'input', () => { visible = PAGE_SIZE; renderLibrary(); });
  on(more, 'click', () => { visible += PAGE_SIZE; renderLibrary(); });
  on(rateInput, 'input', () => { write(RATE_KEY, rateInput.value); rateText.textContent = `Hız ${Number(rateInput.value).toFixed(2)}×`; });
  on(documentRef, STATE_EVENT, (event) => {
    const detail = (event as CustomEvent).detail;
    const next = detail?.speaking && String(detail.origin || '').startsWith('voice-preview:') ? String(detail.origin).slice('voice-preview:'.length) : '';
    if (next !== previewing) { previewing = next; renderDevice(); renderLibrary(); }
  });
  if (root.speechSynthesis) on(root.speechSynthesis, 'voiceschanged', () => { renderCurrent(); renderDevice(); });

  renderCurrent();
  renderDevice();
  if (!canStoreVoices()) libraryHint.textContent += ' Bu bağlantı güvenli olmadığı için indirilen sesler sayfa yenilenince silinir.';
  loadCatalog().then(async (voices) => {
    catalog = voices;
    for (const option of languageOptions(voices)) { const node = el('option', '', `${option.label} (${option.count})`); node.value = option.family; familySelect.append(node); }
    const all = el('option', '', `Tüm diller (${voices.length})`);
    all.value = '';
    familySelect.append(all);
    familySelect.value = 'tr';
    owned = await downloadedKeys(voices);
    render();
  }).catch(() => { libraryHint.textContent = 'Ses kütüphanesi şu an yüklenemedi.'; more.hidden = true; });
  return () => { listeners.forEach((off) => off()); for (const entry of downloads.values()) entry.controller.abort(); panel.remove(); };
}

const api = Object.freeze({ describeVoice, installVoiceSettings, languageOptions });
(globalThis as typeof globalThis & { HafizeVoiceSettings?: unknown }).HafizeVoiceSettings = api;
// settings-workspace.ts builds its page while the app starts, so wait for it once, then stop watching.
if (typeof document !== 'undefined') {
  const attach = () => {
    const host = document.querySelector('.settings-workspace');
    if (host) { installVoiceSettings(document, host); return true; }
    return false;
  };
  if (!attach()) {
    const watcher = new MutationObserver(() => { if (attach()) watcher.disconnect(); });
    watcher.observe(document.documentElement, { childList: true, subtree: true });
  }
}
