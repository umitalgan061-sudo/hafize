interface WorkspaceExtraWindow extends Window {
  HafizeGitHubWorkspaceExtra?: Readonly<{ mount: () => GitHubWorkspaceExtraController | null }>;
}
export interface GitHubWorkspaceExtraController {
  readonly mounted: true;
  readonly destroy: () => void;
}
type ExtraAction = 'directory' | 'compare';
type RecordValue = Record<string, unknown>;

const root = globalThis as WorkspaceExtraWindow;
const CARD_ID = 'githubWorkspaceCard';
const MAX_TEXT = 400;
const MAX_QUERY = 120;

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function clamp(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}
function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}
async function call(action: ExtraAction, repository: string, ref: string, path: string, base: string): Promise<RecordValue> {
  const endpoint = action === 'directory' ? '/api/github/workspace/directory' : '/api/github/workspace/compare';
  const params = new URLSearchParams({ repository });
  if (action === 'directory') {
    if (ref) params.set('ref', ref);
    if (path) params.set('path', path);
  } else {
    params.set('base', base);
    params.set('head', ref);
  }
  const response = await fetch(endpoint + '?' + params.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store'
  });
  let payload: unknown = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new Error(clamp(record(payload).error, 100) || 'GITHUB_WORKSPACE_FAILED');
  return record(payload);
}
function githubLink(doc: Document, url: unknown): HTMLAnchorElement | null {
  const value = clamp(url, 500);
  if (!/^https:\/\/github\.com\//i.test(value)) return null;
  const link = make(doc, 'a', 'Aç', 'github-workspace-extra-link') as HTMLAnchorElement;
  link.href = value;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function mount(documentRef: Document = root.document): GitHubWorkspaceExtraController | null {
  const card = documentRef?.getElementById(CARD_ID);
  if (!documentRef || !card || card.querySelector('.github-workspace-extra')) return null;

  const box = make(documentRef, 'div', undefined, 'github-workspace-extra');
  const head = make(documentRef, 'div', undefined, 'github-workspace-extra-head');
  head.append(make(documentRef, 'strong', 'Ek okuma araçları'), make(documentRef, 'span', 'salt okunur'));
  const controls = make(documentRef, 'div', undefined, 'github-workspace-extra-controls');

  const path = card.querySelector<HTMLInputElement>('input[aria-label="GitHub dosya yolu"]');
  const inputs = [...card.querySelectorAll<HTMLInputElement>('input')];
  const repository = inputs.find((input) => input.getAttribute('aria-label') === 'GitHub repository');
  const ref = inputs.find((input) => input.getAttribute('aria-label') === 'GitHub branch veya ref');
  if (!repository || !ref || !path) return null;

  const base = make(documentRef, 'input') as HTMLInputElement;
  base.type = 'text'; base.maxLength = MAX_TEXT; base.placeholder = 'Karşılaştırma base ref';
  base.autocomplete = 'off'; base.spellcheck = false;
  base.setAttribute('aria-label', 'GitHub karşılaştırma base ref');

  const dirPath = make(documentRef, 'input') as HTMLInputElement;
  dirPath.type = 'text'; dirPath.maxLength = MAX_TEXT; dirPath.placeholder = 'Dizin yolu (opsiyonel)';
  dirPath.autocomplete = 'off'; dirPath.spellcheck = false;
  dirPath.setAttribute('aria-label', 'GitHub dizin yolu');

  const directoryButton = make(documentRef, 'Dizin listele', 'mini-btn') as HTMLButtonElement;
  const compareButton = make(documentRef, 'Ref karşılaştır', 'mini-btn') as HTMLButtonElement;
  const status = make(documentRef, 'Dizin veya iki ref ile karşılaştırma seç.', 'github-workspace-extra-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const result = make(documentRef, 'div', undefined, 'github-workspace-extra-result');
  result.setAttribute('aria-live', 'polite');
  controls.append(directoryButton, compareButton);
  box.append(head, controls, dirPath, base, status, result);
  card.append(box);

  let destroyed = false;

  const report = (message: string): void => { status.textContent = clamp(message, 220); };
  const renderDirectory = (payload: RecordValue): void => {
    result.replaceChildren();
    const list = make(documentRef, 'div', undefined, 'github-workspace-extra-list');
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    if (!entries.length) list.append(make(documentRef, 'span', 'Dizin boş veya erişilebilir kayıt yok.', 'github-workspace-extra-empty'));
    entries.forEach((raw) => {
      const entry = record(raw);
      const row = make(documentRef, 'div', undefined, 'github-workspace-extra-row');
      const name = clamp(entry.name, MAX_TEXT);
      const type = clamp(entry.type, 20);
      row.append(make(documentRef, 'strong', (type === 'dir' ? '▸ ' : '· ') + name), make(documentRef, 'code', clamp(entry.sha, 10)));
      const link = githubLink(documentRef, entry.htmlUrl);
      if (link) row.append(link);
      if (type === 'dir') {
        row.tabIndex = 0; row.setAttribute('role', 'button');
        const choose = (): void => { dirPath.value = clamp(entry.path, MAX_TEXT); report(dirPath.value + ' seçildi.'); };
        row.addEventListener('click', choose);
        row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
      }
      list.append(row);
    });
    result.append(list);
  };

  const renderCompare = (payload: RecordValue): void => {
    result.replaceChildren();
    const summary = make(documentRef, 'div', undefined, 'github-workspace-extra-summary');
    summary.append(
      make(documentRef, 'strong', clamp(payload.status, 40) || 'değişiklik durumu'),
      make(documentRef, 'span', 'base: ' + clamp(payload.base, MAX_QUERY) + ' · head: ' + clamp(payload.head, MAX_QUERY)),
      make(documentRef, 'span', 'commit: ' + String(payload.totalCommits ?? 0) + ' · ahead: ' + String(payload.aheadBy ?? 0) + ' · behind: ' + String(payload.behindBy ?? 0))
    );
    const list = make(documentRef, 'div', undefined, 'github-workspace-extra-list');
    const files = Array.isArray(payload.files) ? payload.files : [];
    if (!files.length) list.append(make(documentRef, 'span', 'Ref’ler arasında dosya farkı bulunamadı.', 'github-workspace-extra-empty'));
    files.forEach((raw) => {
      const file = record(raw);
      const row = make(documentRef, 'div', undefined, 'github-workspace-extra-row');
      row.append(make(documentRef, 'strong', clamp(file.filename, MAX_TEXT)));
      row.append(make(documentRef, 'span', clamp(file.status, 30) + ' · +' + String(file.additions ?? 0) + ' / -' + String(file.deletions ?? 0)));
      list.append(row);
    });
    result.append(summary, list);
  };

  const run = async (action: ExtraAction): Promise<void> => {
    const repo = clamp(repository.value, 120);
    const head = clamp(ref.value, 200);
    const selectedPath = clamp(dirPath.value, MAX_TEXT);
    const baseRef = clamp(base.value, MAX_TEXT);
    if (!repo) return report('Repository gerekli.');
    if (action === 'compare' && (!baseRef || !head || baseRef === head)) return report('Base ve head ref farklı olmalı.');
    status.textContent = 'GitHub okunuyor…';
    directoryButton.disabled = true; compareButton.disabled = true;
    try {
      const payload = await call(action, repo, head, selectedPath, baseRef);
      if (!destroyed) { action === 'directory' ? renderDirectory(payload) : renderCompare(payload); report(action === 'directory' ? 'Dizin okundu.' : 'Ref karşılaştırması okundu.'); }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'GITHUB_WORKSPACE_FAILED';
      const labels: Record<string, string> = {
        GITHUB_REPO_NOT_ALLOWED: 'Repository sunucu allowlist’inde değil.',
        INVALID_GITHUB_REPOSITORY: 'Repository biçimi sahip/depo olmalı.',
        INVALID_GITHUB_REF: 'Ref geçersiz.',
        INVALID_GITHUB_PATH: 'Dizin yolu geçersiz.',
        GITHUB_ENDPOINT_FAILED: 'GitHub isteği başarısız oldu.',
        GITHUB_NOT_CONFIGURED: 'Sunucuda GitHub okuma bağlantısı yok.'
      };
      report(labels[code] || 'GitHub verisi okunamadı.');
    } finally {
      directoryButton.disabled = false; compareButton.disabled = false;
    }
  };

  directoryButton.addEventListener('click', () => void run('directory'));
  compareButton.addEventListener('click', () => void run('compare'));

  return Object.freeze({
    mounted: true,
    destroy: () => { destroyed = true; box.remove(); }
  });
}

const api = Object.freeze({ mount });
root.HafizeGitHubWorkspaceExtra = api;
const start = (): void => { if (root.document) mount(root.document); };
if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
