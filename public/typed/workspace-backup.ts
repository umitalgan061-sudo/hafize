// TypeScript workspace backup center.
// User-controlled local data only; server schedules, credentials and sessions are never exported.
export type WorkspaceBackupKind = 'conversation' | 'message-workspace' | 'prompt-library' | 'prompt-library-state' | 'prompt-collections' | 'prompt-revisions' | 'prompt-smart-fill' | 'model-preferences' | 'composer-history' | 'composer-history-settings' | 'scheduled-task-templates' | 'scheduled-task-draft';

export interface WorkspaceBackupSection {
  id: string;
  key: string;
  kind: WorkspaceBackupKind;
  label: string;
  description: string;
  data: unknown;
  bytes: number;
}

export interface WorkspaceBackupPayload {
  format: 'hafize-workspace-backup';
  version: 1;
  exportedAt: string;
  source: 'local-device';
  sections: WorkspaceBackupSection[];
  integrity: { algorithm: 'SHA-256'; digest: string } | null;
  skipped?: string[];
}

export interface WorkspaceBackupInspection {
  valid: boolean;
  integrity: 'verified' | 'unverified' | 'failed';
  sections: WorkspaceBackupSection[];
  totalBytes: number;
  skipped: string[];
  reason?: string;
}

export interface WorkspaceBackupRestoreResult {
  restored: number;
  removed: number;
  rolledBack: boolean;
  warnings: string[];
}

const MAX_BACKUP_BYTES = 2_000_000;
const MAX_SECTION_BYTES = 1_200_000;
const MAX_SECTIONS = 32;
const MAX_SMART_FILL_ENTRIES = 24;
const MAX_KEY_LENGTH = 180;
const MAX_TEXT = 240;
const SMART_FILL_PREFIX = 'hafize.prompt-library.smart-fill.v1.';
const META_KEY = 'hafize.workspace-backup.meta.v1';
const BACKUP_FORMAT = 'hafize-workspace-backup' as const;

const STATIC_SURFACES: ReadonlyArray<Readonly<{
  key: string;
  kind: WorkspaceBackupKind;
  label: string;
  description: string;
}>> = Object.freeze([
  { key: 'hafize.conversations.v1', kind: 'conversation', label: 'Sohbetler', description: 'Yerel konuşma geçmişi ve dalları.' },
  { key: 'hafize.message-workspace.v1', kind: 'message-workspace', label: 'Mesaj çalışma alanı', description: 'Mesaj notları, etiketler ve geri bildirimler.' },
  { key: 'hafize.prompt-library.v1', kind: 'prompt-library', label: 'İstem kütüphanesi', description: 'İstemler, etiketler, favoriler ve kullanım sayaçları.' },
  { key: 'hafize.prompt-library.v1.state', kind: 'prompt-library-state', label: 'İstem filtreleri', description: 'Kütüphane arama, filtre ve sıralama durumu.' },
  { key: 'hafize.prompt-library.collections.v1', kind: 'prompt-collections', label: 'İstem koleksiyonları', description: 'Yerel koleksiyonlar ve üyelikleri.' },
  { key: 'hafize.prompt-library.revisions.v1', kind: 'prompt-revisions', label: 'İstem sürümleri', description: 'İstem sürüm geçmişi ve geri alma noktaları.' },
  { key: 'hafize.model-preferences.v1', kind: 'model-preferences', label: 'Model tercihleri', description: 'Seçili model, ajan ve yerel profil tercihleri.' },
  { key: 'hafize.composer-history.v1', kind: 'composer-history', label: 'Composer geçmişi', description: 'Cihazdaki son yazılan mesajlar.' },
  { key: 'hafize.composer-history.settings.v1', kind: 'composer-history-settings', label: 'Composer ayarları', description: 'Geçmiş saklama tercihi.' },
  { key: 'hafize.scheduled-task-templates.v1', kind: 'scheduled-task-templates', label: 'Görev şablonları', description: 'Yerel görev şablonları; gerçek planlanmış görevler değildir.' },
  { key: 'hafize.scheduled-task-draft.v1', kind: 'scheduled-task-draft', label: 'Görev taslağı', description: 'Yerel, geçici görev formu taslağı.' }
]);

const SURFACE_MAP = new Map(STATIC_SURFACES.map((surface) => [surface.key, surface]));
const text = (value: unknown, limit = MAX_TEXT): string => String(value ?? '').replace(/\\0/g, '').slice(0, limit);
const now = (): string => new Date().toISOString();
const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function safeJson(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (isRecord(value)) {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) return Promise.reject(new Error('INTEGRITY_UNAVAILABLE'));
  return globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then((buffer) =>
    Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  );
}

function safeStorage(storage: Storage | null | undefined): Storage | null {
  try {
    const candidate = storage || globalThis.localStorage;
    if (!candidate || typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function') return null;
    return candidate;
  } catch { return null; }
}

function readRaw(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function sectionFromStatic(storage: Storage, surface: typeof STATIC_SURFACES[number]): WorkspaceBackupSection | null {
  const raw = readRaw(storage, surface.key);
  if (raw === null) return null;
  const data = safeJson(raw);
  if (data === null) return null;
  const bytes = byteLength(JSON.stringify(data));
  if (bytes > MAX_SECTION_BYTES) return null;
  return {
    id: surface.key,
    key: surface.key,
    kind: surface.kind,
    label: surface.label,
    description: surface.description,
    data,
    bytes
  };
}

function smartFillEntries(storage: Storage): WorkspaceBackupSection | null {
  const entries: Array<{ key: string; data: unknown }> = [];
  for (let index = 0; index < storage.length && entries.length < MAX_SMART_FILL_ENTRIES; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(SMART_FILL_PREFIX) || key.length > MAX_KEY_LENGTH) continue;
    const suffix = key.slice(SMART_FILL_PREFIX.length);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(suffix)) continue;
    const raw = readRaw(storage, key);
    const data = safeJson(raw);
    if (data === null) continue;
    entries.push({ key, data });
  }
  if (!entries.length) return null;
  const bytes = byteLength(JSON.stringify(entries));
  if (bytes > MAX_SECTION_BYTES) return null;
  return {
    id: 'hafize.prompt-library.smart-fill.v1.*',
    key: SMART_FILL_PREFIX,
    kind: 'prompt-smart-fill',
    label: 'Akıllı doldurma değerleri',
    description: 'İstem değişkenleri için yerel değer setleri.',
    data: { entries },
    bytes
  };
}

export function collectSections(storageInput?: Storage): { sections: WorkspaceBackupSection[]; skipped: string[]; totalBytes: number } {
  const storage = safeStorage(storageInput);
  if (!storage) return { sections: [], skipped: ['localStorage kullanılamıyor.'], totalBytes: 0 };
  const sections: WorkspaceBackupSection[] = [];
  const skipped: string[] = [];
  for (const surface of STATIC_SURFACES) {
    const section = sectionFromStatic(storage, surface);
    if (section) sections.push(section);
    else if (readRaw(storage, surface.key) !== null) skipped.push(surface.key);
  }
  const smartFill = smartFillEntries(storage);
  if (smartFill) sections.push(smartFill);
  else {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(SMART_FILL_PREFIX)) { skipped.push('Akıllı doldurma değerlerinden bazıları'); break; }
    }
  }
  sections.sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  return { sections: sections.slice(0, MAX_SECTIONS), skipped, totalBytes: sections.reduce((sum, section) => sum + section.bytes, 0) };
}

function backupWithoutIntegrity(payload: WorkspaceBackupPayload): string {
  return stableJson({
    format: payload.format,
    version: payload.version,
    exportedAt: payload.exportedAt,
    source: payload.source,
    sections: payload.sections,
    ...(payload.skipped?.length ? { skipped: payload.skipped.slice(0, 24) } : {})
  });
}

export async function createBackup(storageInput?: Storage, ids?: readonly string[]): Promise<WorkspaceBackupPayload> {
  const collected = collectSections(storageInput);
  const { sections: allSections, skipped } = collected;
  const wanted = ids && ids.length ? new Set(ids.slice(0, MAX_SECTIONS)) : null;
  const sections = wanted ? allSections.filter((section) => wanted.has(section.id)) : allSections;
  const totalBytes = sections.reduce((sum, section) => sum + section.bytes, 0);
  if (!sections.length) throw new Error(skipped.length ? 'NO_EXPORTABLE_DATA' : 'NO_LOCAL_DATA');
  const base: WorkspaceBackupPayload = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: now(),
    source: 'local-device',
    sections,
    ...(skipped.length ? { skipped: skipped.slice(0, 24) } : {}),
    integrity: null
  };
  const digest = await sha256(backupWithoutIntegrity(base));
  const payload = { ...base, integrity: { algorithm: 'SHA-256' as const, digest } };
  const serialized = JSON.stringify(payload);
  if (byteLength(serialized) > MAX_BACKUP_BYTES) throw new Error('BACKUP_TOO_LARGE');
  if (skipped.length || totalBytes > MAX_BACKUP_BYTES) {
    // The collector remains bounded, but surface the condition through metadata in the UI.
    void skipped;
  }
  return payload;
}

function validStaticSection(section: unknown): WorkspaceBackupSection | null {
  if (!isRecord(section)) return null;
  const key = text(section.key, MAX_KEY_LENGTH);
  const surface = SURFACE_MAP.get(key);
  if (!surface) return null;
  const id = text(section.id, MAX_KEY_LENGTH);
  const data = section.data;
  if (!id || data === undefined) return null;
  const bytes = byteLength(JSON.stringify(data));
  if (bytes > MAX_SECTION_BYTES) return null;
  return { id, key, kind: surface.kind, label: surface.label, description: surface.description, data, bytes };
}

function validSmartFillSection(section: unknown): WorkspaceBackupSection | null {
  if (!isRecord(section) || text(section.key, MAX_KEY_LENGTH) !== SMART_FILL_PREFIX) return null;
  const rawEntries = isRecord(section.data) && Array.isArray(section.data.entries) ? section.data.entries : [];
  const entries: Array<{ key: string; data: unknown }> = [];
  for (const raw of rawEntries.slice(0, MAX_SMART_FILL_ENTRIES)) {
    if (!isRecord(raw)) continue;
    const key = text(raw.key, MAX_KEY_LENGTH);
    if (!key.startsWith(SMART_FILL_PREFIX) || !/^[A-Za-z0-9_-]{1,120}$/.test(key.slice(SMART_FILL_PREFIX.length))) continue;
    if (raw.data === undefined) continue;
    entries.push({ key, data: raw.data });
  }
  if (!entries.length) return null;
  const data = { entries };
  const bytes = byteLength(JSON.stringify(data));
  if (bytes > MAX_SECTION_BYTES) return null;
  return {
    id: SMART_FILL_PREFIX,
    key: SMART_FILL_PREFIX,
    kind: 'prompt-smart-fill',
    label: 'Akıllı doldurma değerleri',
    description: 'İstem değişkenleri için yerel değer setleri.',
    data,
    bytes
  };
}

export async function inspectBackup(rawText: string): Promise<WorkspaceBackupInspection> {
  const size = byteLength(rawText);
  if (size > MAX_BACKUP_BYTES) return { valid: false, integrity: 'failed', sections: [], totalBytes: size, skipped: [], reason: 'Yedek 2 MB sınırını aşıyor.' };
  let parsed: unknown;
  try { parsed = JSON.parse(rawText); } catch { return { valid: false, integrity: 'failed', sections: [], totalBytes: size, skipped: [], reason: 'JSON biçimi geçersiz.' }; }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT || parsed.version !== 1 || parsed.source !== 'local-device' || !Array.isArray(parsed.sections)) {
    return { valid: false, integrity: 'failed', sections: [], totalBytes: size, skipped: [], reason: 'Hafize workspace yedeği biçimi tanınmadı.' };
  }
  const sections: WorkspaceBackupSection[] = [];
  const skipped: string[] = [];
  for (const rawSection of parsed.sections.slice(0, MAX_SECTIONS)) {
    const smart = validSmartFillSection(rawSection);
    const staticSection = smart ? null : validStaticSection(rawSection);
    if (smart || staticSection) sections.push(smart || staticSection as WorkspaceBackupSection);
    else skipped.push('Geçersiz veya izin verilmeyen yüzey');
  }
  if (!sections.length) return { valid: false, integrity: 'failed', sections: [], totalBytes: size, skipped, reason: 'Geri yüklenebilir veri yüzeyi bulunamadı.' };
  const candidate: WorkspaceBackupPayload = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: text(parsed.exportedAt, 40),
    source: 'local-device',
    sections,
    ...(Array.isArray(parsed.skipped) ? { skipped: parsed.skipped.filter((entry): entry is string => typeof entry === 'string').slice(0, 24).map((entry) => text(entry, 180)) } : {}),
    integrity: isRecord(parsed.integrity) && parsed.integrity.algorithm === 'SHA-256' && typeof parsed.integrity.digest === 'string'
      ? { algorithm: 'SHA-256', digest: text(parsed.integrity.digest, 128) } : null
  };
  let integrity: WorkspaceBackupInspection['integrity'] = 'unverified';
  if (candidate.integrity?.digest) {
    try {
      const actual = await sha256(backupWithoutIntegrity(candidate));
      integrity = actual === candidate.integrity.digest ? 'verified' : 'failed';
    } catch { integrity = 'unverified'; }
  }
  if (integrity === 'failed') return { valid: false, integrity, sections, totalBytes: size, skipped, reason: 'Yedek bütünlük doğrulamasından geçmedi.' };
  return { valid: true, integrity, sections, totalBytes: size, skipped };
}

function selectedSections(sections: readonly WorkspaceBackupSection[], ids: readonly string[]): WorkspaceBackupSection[] {
  const wanted = new Set(ids.slice(0, MAX_SECTIONS));
  return sections.filter((section) => wanted.has(section.id));
}

function captureRaw(storage: Storage, sections: readonly WorkspaceBackupSection[]): Map<string, string | null> {
  const captured = new Map<string, string | null>();
  for (const section of sections) {
    if (section.kind === 'prompt-smart-fill') {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(SMART_FILL_PREFIX)) captured.set(key, readRaw(storage, key));
      }
    } else captured.set(section.key, readRaw(storage, section.key));
  }
  return captured;
}

function restoreRaw(storage: Storage, captured: Map<string, string | null>): void {
  for (const [key, raw] of captured) {
    try {
      if (raw === null) storage.removeItem(key);
      else storage.setItem(key, raw);
    } catch {
      // Best effort rollback; the original operation reports the failure.
    }
  }
}

export function restoreSelected(storageInput: Storage | undefined, sections: readonly WorkspaceBackupSection[], ids: readonly string[]): WorkspaceBackupRestoreResult {
  const storage = safeStorage(storageInput);
  if (!storage) return { restored: 0, removed: 0, rolledBack: false, warnings: ['localStorage kullanılamıyor.'] };
  const selected = selectedSections(sections, ids);
  if (!selected.length) return { restored: 0, removed: 0, rolledBack: false, warnings: ['Geri yüklenecek yüzey seçilmedi.'] };
  const captured = captureRaw(storage, selected);
  let restored = 0;
  let removed = 0;
  try {
    for (const section of selected) {
      if (section.kind === 'prompt-smart-fill') {
        const entries = isRecord(section.data) && Array.isArray(section.data.entries) ? section.data.entries : [];
        const currentKeys: string[] = [];
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key?.startsWith(SMART_FILL_PREFIX)) currentKeys.push(key);
        }
        for (const key of currentKeys) { storage.removeItem(key); removed += 1; }
        for (const entry of entries) {
          if (!isRecord(entry)) continue;
          const key = text(entry.key, MAX_KEY_LENGTH);
          if (!key.startsWith(SMART_FILL_PREFIX)) continue;
          storage.setItem(key, JSON.stringify(entry.data));
          restored += 1;
        }
        continue;
      }
      const normalized = JSON.stringify(section.data);
      if (normalized === undefined) throw new Error('INVALID_SECTION');
      storage.setItem(section.key, normalized);
      restored += 1;
    }
    return { restored, removed, rolledBack: false, warnings: [] };
  } catch {
    restoreRaw(storage, captured);
    return { restored: 0, removed: 0, rolledBack: true, warnings: ['Depolama işlemi başarısız oldu; seçili veriler geri alındı.'] };
  }
}

function surfaceContainsSensitiveKey(key: string): boolean {
  const lower = key.toLocaleLowerCase('en-US');
  return lower.includes('token') || lower.includes('secret') || lower.includes('credential') || lower.includes('password') || lower.includes('oauth') || lower.includes('session') || lower.includes('auth.');
}

export function allowedStorageKey(key: unknown): boolean {
  const value = text(key, MAX_KEY_LENGTH);
  if (!value || surfaceContainsSensitiveKey(value)) return false;
  return SURFACE_MAP.has(value) || value.startsWith(SMART_FILL_PREFIX);
}

export function backupMetadata(storageInput?: Storage): { exportedAt: string; sections: number; bytes: number } | null {
  const storage = safeStorage(storageInput);
  if (!storage) return null;
  try {
    const value = safeJson(storage.getItem(META_KEY));
    if (!isRecord(value)) return null;
    const exportedAt = text(value.exportedAt, 40);
    const sections = Number.isFinite(Number(value.sections)) ? Math.max(0, Math.min(MAX_SECTIONS, Number(value.sections))) : 0;
    const bytes = Number.isFinite(Number(value.bytes)) ? Math.max(0, Math.min(MAX_BACKUP_BYTES, Number(value.bytes))) : 0;
    return { exportedAt, sections, bytes };
  } catch { return null; }
}

export function saveBackupMetadata(storageInput: Storage | undefined, payload: WorkspaceBackupPayload): void {
  const storage = safeStorage(storageInput);
  if (!storage) return;
  try { storage.setItem(META_KEY, JSON.stringify({ exportedAt: payload.exportedAt, sections: payload.sections.length, bytes: byteLength(JSON.stringify(payload)) })); } catch {}
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, label = '', className = ''): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (label) node.textContent = label;
  return node;
}

function button(doc: Document, label: string, className = 'mini-btn'): HTMLButtonElement {
  const node = make(doc, 'button', label, className);
  node.type = 'button';
  return node;
}

export interface WorkspaceBackupController { refresh: () => void; destroy: () => void; openImport: () => void; }

export function mountWorkspaceBackup(documentRef: Document = document, rootRef: Window = globalThis as Window & typeof globalThis): WorkspaceBackupController | null {
  const rail = documentRef?.querySelector?.('.utility-rail');
  if (!documentRef || !rail || documentRef.getElementById('workspaceBackupPanel')) return null;

  const section = make(documentRef, 'section', '', 'utility-card workspace-backup-panel');
  section.id = 'workspaceBackupPanel';
  section.setAttribute('aria-labelledby', 'workspaceBackupTitle');
  const header = make(documentRef, 'div', '', 'workspace-backup-head');
  const title = make(documentRef, 'strong', 'Çalışma alanı yedeği', 'workspace-backup-title');
  title.id = 'workspaceBackupTitle';
  // The keyboard shortcut is bound below but was only written down in the
  // README, so nothing in the app told the reader it exists. Other panels
  // surface theirs the same way.
  const shortcut = make(documentRef, 'span', 'Ctrl / ⌘ + Shift + Y', 'workspace-backup-shortcut');
  shortcut.setAttribute('aria-hidden', 'true');
  const collapse = button(documentRef, 'Gizle');
  collapse.setAttribute('aria-expanded', 'true');
  collapse.setAttribute('aria-controls', 'workspaceBackupBody');
  header.append(title, shortcut, collapse);
  const body = make(documentRef, 'div');
  body.id = 'workspaceBackupBody';
  body.className = 'workspace-backup-body';
  const summary = make(documentRef, 'div', '', 'workspace-backup-summary');
  const summaryTitle = make(documentRef, 'strong', 'Yerel veriler');
  const summaryText = make(documentRef, '');
  summary.append(summaryTitle, summaryText);
  const exportScope = make(documentRef, 'div', '', 'workspace-backup-export-scope');
  const exportScopeTitle = make(documentRef, 'strong', 'Yedek kapsamı');
  const exportScopeHint = make(documentRef, 'Hangi yerel yüzeylerin yedeğe gireceğini seçebilirsin.', '', 'workspace-backup-export-hint');
  const exportScopeActions = make(documentRef, 'div', '', 'workspace-backup-select-actions');
  const exportAll = button(documentRef, 'Tümünü seç');
  const exportNone = button(documentRef, 'Seçimleri temizle');
  exportScopeActions.append(exportAll, exportNone);
  const exportList = make(documentRef, 'div', '', 'workspace-backup-export-list');
  exportList.setAttribute('role', 'group');
  exportScope.append(exportScopeTitle, exportScopeHint, exportScopeActions, exportList);
  const actions = make(documentRef, 'div', '', 'workspace-backup-actions');
  const exportButton = button(documentRef, 'Yedeği indir', 'soft-btn');
  exportButton.setAttribute('aria-keyshortcuts', 'Control+Shift+Y Meta+Shift+Y');
  const importButton = button(documentRef, 'Yedekten geri yükle', 'soft-btn');
  const fileInput = documentRef.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'application/json,.json'; fileInput.hidden = true;
  actions.append(exportButton, importButton);
  const status = make(documentRef, 'div', '', 'workspace-backup-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const preview = make(documentRef, 'div', '', 'workspace-backup-preview');
  preview.hidden = true;
  preview.setAttribute('role', 'dialog');
  preview.setAttribute('aria-modal', 'false');
  preview.setAttribute('aria-labelledby', 'workspaceBackupPreviewTitle');
  const previewTitle = make(documentRef, 'strong', 'Geri yükleme önizlemesi');
  previewTitle.id = 'workspaceBackupPreviewTitle';
  const integrity = make(documentRef, 'div', '', 'workspace-backup-integrity');
  const selectActions = make(documentRef, 'div', '', 'workspace-backup-select-actions');
  const all = button(documentRef, 'Tümünü seç');
  const none = button(documentRef, 'Seçimleri temizle');
  selectActions.append(all, none);
  const list = make(documentRef, 'div', '', 'workspace-backup-section-list');
  list.setAttribute('role', 'group');
  const previewActions = make(documentRef, 'div', '', 'workspace-backup-preview-actions');
  const cancel = button(documentRef, 'Vazgeç');
  const restore = button(documentRef, 'Seçilenleri geri yükle', 'soft-btn');
  previewActions.append(cancel, restore);
  preview.append(previewTitle, integrity, selectActions, list, previewActions);
  body.append(summary, exportScope, actions, fileInput, status, preview);
  section.append(header, body);
  rail.append(section);

  const listeners: Array<() => void> = [];
  const on = (target: EventTarget, type: string, listener: EventListener) => { target.addEventListener(type, listener); listeners.push(() => target.removeEventListener(type, listener)); };
  let lastInspection: WorkspaceBackupInspection | null = null;
  let previousFocus: Element | null = null;
  let hidden = false;
  let destroyed = false;

  const report = (message: string) => { status.textContent = text(message, 220); };
  const localSections = () => collectSections(rootRef.localStorage);

  function renderExportChoices(): void {
    const snapshot = localSections();
    const hadChoices = exportList.querySelectorAll<HTMLInputElement>('input[data-backup-export-section]').length > 0;
    const previous = hadChoices ? new Set(selectedExportIds()) : null;
    exportList.replaceChildren();
    for (const sectionInfo of snapshot.sections) {
      const label = make(documentRef, 'label', '', 'workspace-backup-choice');
      const check = documentRef.createElement('input');
      check.type = 'checkbox';
      check.checked = previous ? previous.has(sectionInfo.id) : true;
      check.value = sectionInfo.id;
      check.dataset.backupExportSection = sectionInfo.id;
      const copy = make(documentRef, 'span', '', 'workspace-backup-choice-copy');
      copy.append(make(documentRef, 'strong', sectionInfo.label), make(documentRef, 'small', sectionInfo.description));
      label.append(check, copy, make(documentRef, 'span', formatBytes(sectionInfo.bytes), 'workspace-backup-choice-size'));
      exportList.append(label);
    }
    if (!snapshot.sections.length) exportList.append(make(documentRef, 'small', 'Yedeklenebilir yerel yüzey bulunmuyor.', 'workspace-backup-export-empty'));
  }

  function selectedExportIds(): string[] {
    return Array.from(exportList.querySelectorAll<HTMLInputElement>('input[data-backup-export-section]:checked')).map((input) => input.value).slice(0, MAX_SECTIONS);
  }

  function renderSummary(): void {
    if (destroyed) return;
    const snapshot = localSections();
    renderExportChoices();
    const meta = backupMetadata(rootRef.localStorage);
    summaryText.textContent = snapshot.sections.length
      ? snapshot.sections.length + ' yüzey · ' + formatBytes(snapshot.totalBytes) + (meta?.exportedAt ? ' · son yedek ' + new Date(meta.exportedAt).toLocaleString('tr-TR') : '')
      : 'Yedeklenebilir yerel veri bulunmuyor.';
  }

  function renderPreview(inspection: WorkspaceBackupInspection): void {
    lastInspection = inspection;
    list.replaceChildren();
    integrity.textContent = inspection.integrity === 'verified' ? 'Bütünlük: doğrulandı (SHA-256)' : inspection.integrity === 'unverified' ? 'Bütünlük: imza yok veya doğrulama kullanılamıyor' : 'Bütünlük: başarısız';
    restore.disabled = inspection.integrity === 'failed';
    for (const sectionInfo of inspection.sections) {
      const label = make(documentRef, 'label', '', 'workspace-backup-choice');
      const check = documentRef.createElement('input');
      check.type = 'checkbox'; check.value = sectionInfo.id;
      check.dataset.backupSection = sectionInfo.id;
      const copy = make(documentRef, 'span', '', 'workspace-backup-choice-copy');
      copy.append(make(documentRef, 'strong', sectionInfo.label), make(documentRef, 'small', sectionInfo.description));
      label.append(check, copy, make(documentRef, 'span', formatBytes(sectionInfo.bytes), 'workspace-backup-choice-size'));
      list.append(label);
    }
    preview.hidden = false;
    (list.querySelector('input') as HTMLInputElement | null)?.focus();
  }

  async function handleExport(): Promise<void> {
    try {
      exportButton.disabled = true;
      report('Yedek hazırlanıyor…');
      const ids = selectedExportIds();
      if (!ids.length) throw new Error('NO_EXPORT_SELECTION');
      const payload = await createBackup(rootRef.localStorage, ids);
      const textPayload = JSON.stringify(payload, null, 2);
      if (byteLength(textPayload) > MAX_BACKUP_BYTES) throw new Error('BACKUP_TOO_LARGE');
      const blob = new Blob([textPayload], { type: 'application/json;charset=utf-8' });
      const url = rootRef.URL.createObjectURL(blob);
      const link = make(documentRef, 'a') as HTMLAnchorElement;
      link.href = url;
      link.download = 'hafize-workspace-backup.json';
      link.click();
      rootRef.setTimeout(() => rootRef.URL.revokeObjectURL(url), 0);
      saveBackupMetadata(rootRef.localStorage, payload);
      renderSummary();
      report(payload.sections.length + ' yüzey yedeklendi · ' + formatBytes(byteLength(textPayload)));
    } catch (error) {
      report(error instanceof Error && error.message === 'BACKUP_TOO_LARGE' ? 'Yedek 2 MB sınırını aşamaz.' : error instanceof Error && error.message === 'NO_EXPORT_SELECTION' ? 'En az bir yedek yüzeyi seçmelisin.' : 'Yedek oluşturulamadı.');
    } finally { exportButton.disabled = false; }
  }

  function openImport(): void { previousFocus = documentRef.activeElement; fileInput.click(); }

  async function handleFile(): Promise<void> {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('TOO_LARGE');
      const raw = await file.text();
      const inspection = await inspectBackup(raw);
      if (!inspection.valid) throw new Error(inspection.reason || 'INVALID_BACKUP');
      renderPreview(inspection);
      report(inspection.sections.length + ' yüzey bulundu · seçim yap ve geri yüklemeyi onayla.');
    } catch (error) {
      preview.hidden = true;
      report(error instanceof Error && error.message === 'TOO_LARGE' ? 'Yedek 2 MB sınırını aşamaz.' : error instanceof Error ? error.message : 'Yedek okunamadı.');
    }
  }

  const selectedIds = () => Array.from(list.querySelectorAll<HTMLInputElement>('input[data-backup-section]:checked')).map((input) => input.value).slice(0, MAX_SECTIONS);

  function restoreSelectedFromPreview(): void {
    if (!lastInspection) return;
    const ids = selectedIds();
    if (!ids.length) return report('En az bir yüzey seçmelisin.');
    const labels = lastInspection.sections.filter((entry) => ids.includes(entry.id)).map((entry) => entry.label).join(', ');
    if (!rootRef.confirm?.('Seçilen yerel veriler mevcut verilerin üzerine yazılacak: ' + labels + '. Devam edilsin mi?')) return;
    const result = restoreSelected(rootRef.localStorage, lastInspection.sections, ids);
    if (result.rolledBack) {
      preview.hidden = true;
      return report(result.warnings.join(' '));
    }
    rootRef.dispatchEvent(new rootRef.CustomEvent('hafize:workspace-backup-restored', { detail: { ids, restored: result.restored } }));
    preview.hidden = true;
    renderSummary();
    report(result.restored + ' yüzey geri yüklendi. İlgili paneller otomatik yenilenir.');
    (previousFocus as HTMLElement | null)?.focus?.();
    previousFocus = null;
  }

  on(exportButton, 'click', () => { void handleExport(); });
  on(importButton, 'click', openImport as EventListener);
  on(fileInput, 'change', () => { void handleFile(); });
  on(exportAll, 'click', () => exportList.querySelectorAll<HTMLInputElement>('input[data-backup-export-section]').forEach((input) => { input.checked = true; }));
  on(exportNone, 'click', () => exportList.querySelectorAll<HTMLInputElement>('input[data-backup-export-section]').forEach((input) => { input.checked = false; }));
  on(all, 'click', () => list.querySelectorAll<HTMLInputElement>('input[data-backup-section]').forEach((input) => { input.checked = true; }));
  on(none, 'click', () => list.querySelectorAll<HTMLInputElement>('input[data-backup-section]').forEach((input) => { input.checked = false; }));
  on(cancel, 'click', () => { preview.hidden = true; (previousFocus as HTMLElement | null)?.focus?.(); previousFocus = null; });
  on(restore, 'click', restoreSelectedFromPreview as EventListener);
  on(collapse, 'click', () => {
    hidden = !hidden; body.hidden = hidden; collapse.textContent = hidden ? 'Göster' : 'Gizle'; collapse.setAttribute('aria-expanded', String(!hidden));
  });
  on(rootRef, 'storage', (event: StorageEvent) => { if (event.key === null || allowedStorageKey(event.key)) renderSummary(); });
  on(rootRef, 'hafize:workspace-backup-restored', () => renderSummary());
  for (const eventName of [
    'hafize:prompt-library-changed',
    'hafize:prompt-library-collections-changed',
    'hafize:message-workspace-changed',
    'hafize:composer-history-changed',
    'hafize:composer-history-settings-changed',
    'hafize:model-preferences-changed',
    'hafize:scheduled-task-templates-changed',
    'hafize:conversation-forks-changed'
  ]) on(rootRef, eventName, () => renderSummary());
  on(documentRef, 'keydown', (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'y') return;
    if ((event.target as HTMLElement | null)?.closest?.('input,textarea,select,button,[contenteditable="true"]')) return;
    event.preventDefault(); section.scrollIntoView({ block: 'nearest' }); exportButton.focus();
  });
  renderSummary();

  return Object.freeze<WorkspaceBackupController>({
    refresh: renderSummary,
    openImport,
    destroy: () => { listeners.splice(0).forEach((off) => off()); section.remove(); destroyed = true; },
  });
}

const bootstrap = (): void => { mountWorkspaceBackup(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once: true }); else bootstrap();
