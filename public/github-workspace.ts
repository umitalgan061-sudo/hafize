interface GitHubBranch { readonly name: string; readonly sha: string; readonly protected: boolean; }
interface GitHubCommit { readonly sha: string; readonly shortSha: string; readonly message: string; readonly author: string; readonly date: string; readonly htmlUrl: string; }
interface GitHubPullRequest { readonly number: number; readonly title: string; readonly state: string; readonly draft: boolean; readonly author: string; readonly createdAt: string; readonly updatedAt: string; readonly htmlUrl: string; readonly head: string; readonly base: string; }
interface GitHubWorkspaceWindow extends Window {
  HafizeGitHubWorkspace?: Readonly<{ mount: () => GitHubWorkspaceController | null }>;
}
export interface GitHubWorkspaceController {
  readonly mounted: true;
  readonly destroy: () => void;
  readonly load: (action: WorkspaceAction) => Promise<void>;
}
type WorkspaceAction = 'repo' | 'branches' | 'commits' | 'pulls' | 'file';
type ApiPayload = Record<string, unknown>;

const root = globalThis as GitHubWorkspaceWindow;
const CARD_ID = 'githubWorkspaceCard';
const STATE_KEY = 'hafize.github-workspace.v1';
const MAX_REPOSITORY = 120;
const MAX_REF = 200;
const MAX_PATH = 400;

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, value?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}
function clamp(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function getState(): { repository: string; ref: string; path: string } {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STATE_KEY) || '{}');
    return { repository: clamp(parsed?.repository, MAX_REPOSITORY), ref: clamp(parsed?.ref, MAX_REF), path: clamp(parsed?.path, MAX_PATH) };
  } catch {
    return { repository: '', ref: '', path: '' };
  }
}
function saveState(state: { repository: string; ref: string; path: string }): void {
  try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {}
}
function asRecord(value: unknown): ApiPayload {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ApiPayload : {};
}
async function request(action: WorkspaceAction, repository: string, ref: string, path: string): Promise<ApiPayload> {
  const params = new URLSearchParams({ action, repository, limit: '30' });
  if (ref) params.set('ref', ref);
  if (path) params.set('path', path);
  const response = await fetch('/api/github/workspace?' + params.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store'
  });
  let payload: unknown = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new Error(clamp(asRecord(payload).error, 80) || 'GITHUB_WORKSPACE_FAILED');
  return asRecord(payload);
}
function createLink(doc: Document, url: string, label: string): HTMLAnchorElement | null {
  if (!/^https:\/\/github\.com\//i.test(url)) return null;
  const link = make(doc, 'a', label, 'github-workspace-link') as HTMLAnchorElement;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
function mount(documentRef: Document = root.document, rootRef: GitHubWorkspaceWindow = root): GitHubWorkspaceController | null {
  if (!documentRef) return null;
  const rail = documentRef.querySelector<HTMLElement>('.utility-rail');
  if (!rail || documentRef.getElementById(CARD_ID)) return null;

  const card = make(documentRef, 'section', undefined, 'utility-card github-workspace-card');
  card.id = CARD_ID;
  card.setAttribute('aria-labelledby', 'githubWorkspaceTitle');
  const head = make(documentRef, 'div', undefined, 'utility-head github-workspace-head');
  const title = make(documentRef, 'span', 'GitHub çalışma alanı');
  title.id = 'githubWorkspaceTitle';
  const badge = make(documentRef, 'span', 'salt okunur', 'github-workspace-badge');
  head.append(title, badge);

  const repository = make(documentRef, 'input') as HTMLInputElement;
  repository.type = 'text'; repository.maxLength = MAX_REPOSITORY; repository.placeholder = 'sahip/depo';
  repository.autocomplete = 'off'; repository.spellcheck = false;
  repository.setAttribute('aria-label', 'GitHub repository');

  const ref = make(documentRef, 'input') as HTMLInputElement;
  ref.type = 'text'; ref.maxLength = MAX_REF; ref.placeholder = 'branch veya ref (opsiyonel)';
  ref.autocomplete = 'off'; ref.setAttribute('aria-label', 'GitHub branch veya ref');

  const controls = make(documentRef, 'div', undefined, 'github-workspace-controls');
  const actions: Array<[WorkspaceAction, string]> = [['repo', 'Repo'], ['branches', 'Branch'], ['commits', 'Commit'], ['pulls', 'PR'], ['file', 'Dosya']];
  const buttons = new Map<WorkspaceAction, HTMLButtonElement>();
  actions.forEach(([action, label]) => {
    const button = make(documentRef, 'button', label, 'mini-btn github-workspace-tab') as HTMLButtonElement;
    button.type = 'button'; button.setAttribute('aria-pressed', String(action === 'repo'));
    button.dataset.githubWorkspaceAction = action; controls.append(button); buttons.set(action, button);
  });

  const path = make(documentRef, 'input') as HTMLInputElement;
  path.type = 'text'; path.maxLength = MAX_PATH; path.placeholder = 'Dosya yolu: src/example.ts';
  path.autocomplete = 'off'; path.spellcheck = false; path.hidden = true;
  path.setAttribute('aria-label', 'GitHub dosya yolu');

  const loadButton = make(documentRef, 'Yükle', 'soft-btn') as HTMLButtonElement;
  loadButton.type = 'button';

  const statusLine = make(documentRef, 'Repository ve eylemi seçip Yükle’ye bas.', 'github-workspace-status');
  statusLine.setAttribute('role', 'status'); statusLine.setAttribute('aria-live', 'polite');
  const result = make(documentRef, 'div', undefined, 'github-workspace-result');
  result.setAttribute('aria-live', 'polite');

  const form = make(documentRef, 'div', undefined, 'github-workspace-form');
  form.append(repository, ref, controls, path, loadButton);
  card.append(head, form, statusLine, result); rail.append(card);

  const saved = getState();
  repository.value = saved.repository; ref.value = saved.ref; path.value = saved.path;
  let active: WorkspaceAction = 'repo';
  let destroyed = false;

  const report = (message: string): void => { statusLine.textContent = clamp(message, 220); };
  const setActive = (action: WorkspaceAction): void => {
    active = action;
    buttons.forEach((button, key) => button.setAttribute('aria-pressed', String(key === action)));
    path.hidden = action !== 'file';
  };

  const renderRepo = (payload: ApiPayload): void => {
    result.replaceChildren();
    const summary = make(documentRef, 'div', undefined, 'github-workspace-summary');
    const values: Array<[string, string]> = [
      ['Depo', clamp(payload.fullName || payload.repository, 160)],
      ['Varsayılan branch', clamp(payload.defaultBranch, MAX_REF) || 'main'],
      ['Görünürlük', clamp(payload.visibility, 40) || 'belirtilmemiş'],
      ['Arşiv', payload.archived === true ? 'Evet' : 'Hayır']
    ];
    values.forEach(([label, value]) => {
      const row = make(documentRef, 'div', undefined, 'github-workspace-summary-row');
      row.append(make(documentRef, 'span', label, 'github-workspace-label'), make(documentRef, 'strong', value));
      summary.append(row);
    });
    const link = createLink(documentRef, clamp(payload.htmlUrl, 500), 'GitHub’da aç');
    if (link) summary.append(link);
    result.append(summary);
  };

  const renderBranches = (payload: ApiPayload): void => {
    result.replaceChildren();
    const list = make(documentRef, 'div', undefined, 'github-workspace-list');
    const branches = Array.isArray(payload.branches) ? payload.branches as GitHubBranch[] : [];
    if (!branches.length) list.append(make(documentRef, 'span', 'Branch bulunamadı.', 'github-workspace-empty'));
    branches.forEach((branch) => {
      const row = make(documentRef, 'div', undefined, 'github-workspace-row');
      row.append(make(documentRef, 'strong', branch.name), make(documentRef, 'code', branch.sha.slice(0, 10)));
      if (branch.protected) row.append(make(documentRef, 'span', 'korumalı', 'github-workspace-chip'));
      row.tabIndex = 0; row.setAttribute('role', 'button');
      row.setAttribute('aria-label', branch.name + ' branch’ini ref olarak seç');
      const choose = (): void => {
        ref.value = branch.name;
        saveState({ repository: repository.value, ref: ref.value, path: path.value });
        report(branch.name + ' ref olarak seçildi.');
      };
      row.addEventListener('click', choose);
      row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
      list.append(row);
    });
    result.append(list);
  };

  const renderCommits = (payload: ApiPayload): void => {
    result.replaceChildren();
    const list = make(documentRef, 'div', undefined, 'github-workspace-list');
    const commits = Array.isArray(payload.commits) ? payload.commits as GitHubCommit[] : [];
    if (!commits.length) list.append(make(documentRef, 'span', 'Commit bulunamadı.', 'github-workspace-empty'));
    commits.forEach((commit) => {
      const row = make(documentRef, 'article', undefined, 'github-workspace-row');
      const main = make(documentRef, 'div');
      main.append(make(documentRef, 'strong', commit.message), make(documentRef, 'code', commit.shortSha));
      const meta = make(documentRef, 'div', (commit.author || 'GitHub') + ' · ' + (commit.date ? new Date(commit.date).toLocaleString('tr-TR') : 'tarih yok'), 'github-workspace-meta');
      main.append(meta);
      const link = createLink(documentRef, commit.htmlUrl, 'Aç');
      if (link) main.append(link);
      row.append(main); list.append(row);
    });
    result.append(list);
  };

  const renderPulls = (payload: ApiPayload): void => {
    result.replaceChildren();
    const list = make(documentRef, 'div', undefined, 'github-workspace-list');
    const pulls = Array.isArray(payload.pullRequests) ? payload.pullRequests as GitHubPullRequest[] : [];
    if (!pulls.length) list.append(make(documentRef, 'span', 'PR bulunamadı.', 'github-workspace-empty'));
    pulls.forEach((pull) => {
      const row = make(documentRef, 'article', undefined, 'github-workspace-row');
      const main = make(documentRef, 'div');
      main.append(make(documentRef, 'strong', '#' + pull.number + ' · ' + pull.title));
      main.append(make(documentRef, 'div', (pull.author || 'GitHub') + ' · ' + (pull.head || '?') + ' → ' + (pull.base || '?'), 'github-workspace-meta'));
      if (pull.draft) main.append(make(documentRef, 'span', 'Taslak', 'github-workspace-chip'));
      const link = createLink(documentRef, pull.htmlUrl, 'Aç');
      if (link) main.append(link);
      row.append(main); list.append(row);
    });
    result.append(list);
  };

  const renderFile = (payload: ApiPayload): void => {
    result.replaceChildren();
    const meta = make(documentRef, 'div', clamp(payload.path, MAX_PATH) + ' · ' + Number(payload.size || 0).toLocaleString('tr-TR') + ' byte', 'github-workspace-meta');
    if (payload.truncated === true) meta.textContent += ' · gösterim kısaltıldı';
    const pre = make(documentRef, 'pre', clamp(payload.content, 64 * 1024), 'github-workspace-code');
    result.append(meta, pre);
  };

  const render = (payload: ApiPayload): void => {
    if (active === 'repo') renderRepo(payload);
    else if (active === 'branches') renderBranches(payload);
    else if (active === 'commits') renderCommits(payload);
    else if (active === 'pulls') renderPulls(payload);
    else renderFile(payload);
  };

  const loadAction = async (action: WorkspaceAction): Promise<void> => {
    const repoValue = clamp(repository.value, MAX_REPOSITORY);
    const refValue = clamp(ref.value, MAX_REF);
    const pathValue = clamp(path.value, MAX_PATH);
    if (!repoValue) return report('Repository gerekli. Örnek: sahip/depo');
    if (action === 'file' && !pathValue) return report('Dosya görünümü için yol gerekli.');
    saveState({ repository: repoValue, ref: refValue, path: pathValue });
    loadButton.disabled = true;
    report('GitHub okunuyor…');
    try {
      const payload = await request(action, repoValue, refValue, pathValue);
      if (!destroyed) { render(payload); report(action + ' okundu.'); }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GITHUB_WORKSPACE_FAILED';
      const labels: Record<string, string> = {
        AUTH_REQUIRED: 'GitHub workspace için oturum gerekli.',
        GITHUB_NOT_CONFIGURED: 'Sunucuda GitHub okuma bağlantısı yapılandırılmamış.',
        GITHUB_REPO_NOT_ALLOWED: 'Repository sunucu allowlist’inde değil.',
        INVALID_GITHUB_REPOSITORY: 'Repository biçimi sahip/depo olmalı.',
        INVALID_GITHUB_PATH: 'Dosya yolu geçersiz.',
        SENSITIVE_GITHUB_PATH_BLOCKED: 'Güvenlik nedeniyle bu dosya yolu okunamaz.',
        GITHUB_CONTENT_CREDENTIAL_BLOCKED: 'Dosya içeriği credential politikası nedeniyle gösterilemez.',
        GITHUB_PATH_NOT_FILE: 'Seçilen yol bir dosya değil.',
        GITHUB_READ_FAILED: 'GitHub dosyası okunamadı.',
        GITHUB_ENDPOINT_FAILED: 'GitHub isteği başarısız oldu.'
      };
      report(labels[message] || 'GitHub çalışma alanı okunamadı.');
    } finally {
      loadButton.disabled = false;
    }
  };

  buttons.forEach((button, action) => button.addEventListener('click', () => setActive(action)));
  loadButton.addEventListener('click', () => void loadAction(active));
  [repository, ref, path].forEach((input) => input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); void loadAction(active); }
  }));
  rootRef.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'g') return;
    event.preventDefault(); repository.focus(); repository.select();
  });
  setActive('repo');

  return Object.freeze({
    mounted: true,
    load: loadAction,
    destroy: () => { destroyed = true; card.remove(); }
  });
}

const api = Object.freeze({ mount });
root.HafizeGitHubWorkspace = api;
const start = (): void => { if (root.document) mount(root.document, root); };
if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
