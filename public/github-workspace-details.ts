interface GitHubWorkspaceDetailsWindow extends Window {
  HafizeGitHubWorkspaceDetails?: Readonly<{ mount: () => GitHubWorkspaceDetailsController | null }>;
}
export interface GitHubWorkspaceDetailsController {
  readonly mounted: true;
  readonly destroy: () => void;
}
type ApiRecord = Record<string, unknown>;

// Browser entrypoint: under the Node-flavoured tsconfig `globalThis` is not
// statically a Window, so the browser root is narrowed explicitly here.
const root = globalThis as unknown as GitHubWorkspaceDetailsWindow;
const CARD_ID = 'githubWorkspaceCard';

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function clamp(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ApiRecord : {};
}
async function request(endpoint: string, params: URLSearchParams): Promise<ApiRecord> {
  const response = await fetch(endpoint + '?' + params.toString(), {
    method: 'GET', headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store'
  });
  let payload: unknown = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new Error(clamp(record(payload).error, 100) || 'GITHUB_WORKSPACE_FAILED');
  return record(payload);
}

function mount(documentRef: Document = root.document): GitHubWorkspaceDetailsController | null {
  const card = documentRef?.getElementById(CARD_ID);
  if (!documentRef || !card || card.querySelector('.github-workspace-details')) return null;

  const box = make(documentRef, 'section', undefined, 'github-workspace-details');
  box.setAttribute('aria-labelledby', 'githubWorkspaceDetailsTitle');
  const title = make(documentRef, 'strong', 'Commit / PR ayrıntıları');
  title.id = 'githubWorkspaceDetailsTitle';

  const commitInput = make(documentRef, 'input') as HTMLInputElement;
  commitInput.type = 'text'; commitInput.maxLength = 120; commitInput.placeholder = 'Commit SHA';
  commitInput.setAttribute('aria-label', 'GitHub commit SHA');
  const commitButton = make(documentRef, 'button', 'Commit ayrıntısı', 'mini-btn') as HTMLButtonElement;
  commitButton.type = 'button';

  const prInput = make(documentRef, 'input') as HTMLInputElement;
  prInput.type = 'number'; prInput.min = '1'; prInput.max = '1000000000'; prInput.placeholder = 'PR numarası';
  prInput.setAttribute('aria-label', 'GitHub PR numarası');
  const prButton = make(documentRef, 'button', 'PR ayrıntısı', 'mini-btn') as HTMLButtonElement;
  prButton.type = 'button';

  const status = make(documentRef, 'div', 'Detay okumaya hazır.', 'github-workspace-details-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const result = make(documentRef, 'div', undefined, 'github-workspace-details-result');
  result.setAttribute('aria-live', 'polite');

  const commitRow = make(documentRef, 'div', undefined, 'github-workspace-details-row');
  commitRow.append(commitInput, commitButton);
  const prRow = make(documentRef, 'div', undefined, 'github-workspace-details-row');
  prRow.append(prInput, prButton);
  box.append(title, commitRow, prRow, status, result);
  card.append(box);

  const repository = [...card.querySelectorAll<HTMLInputElement>('input')]
    .find((input) => input.getAttribute('aria-label') === 'GitHub repository');

  const report = (message: string): void => { status.textContent = clamp(message, 220); };
  const renderCommit = (payload: ApiRecord): void => {
    result.replaceChildren();
    const summary = make(documentRef, 'div', undefined, 'github-workspace-details-summary');
    summary.append(make(documentRef, 'strong', clamp(payload.message, 240)));
    summary.append(make(documentRef, 'span', clamp(payload.author, 160) + ' · +' + String(payload.additions ?? 0) + ' / -' + String(payload.deletions ?? 0)));
    const files = Array.isArray(payload.files) ? payload.files : [];
    files.forEach((raw) => {
      const file = record(raw);
      const row = make(documentRef, 'div', undefined, 'github-workspace-details-file');
      row.append(make(documentRef, 'span', clamp(file.filename, 400)), make(documentRef, 'span', clamp(file.status, 30)));
      row.append(make(documentRef, 'small', '+' + String(file.additions ?? 0) + ' / -' + String(file.deletions ?? 0)));
      result.append(row);
    });
    const url = clamp(payload.htmlUrl, 500);
    if (/^https:\/\/github\.com\//i.test(url)) {
      const link = make(documentRef, 'a', 'GitHub’da aç') as HTMLAnchorElement;
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; result.append(link);
    }
    result.prepend(summary);
  };
  const renderPull = (payload: ApiRecord): void => {
    result.replaceChildren();
    const summary = make(documentRef, 'div', undefined, 'github-workspace-details-summary');
    summary.append(make(documentRef, 'strong', '#' + String(payload.number ?? '') + ' · ' + clamp(payload.title, 240)));
    summary.append(make(documentRef, 'span', clamp(payload.author, 120) + ' · ' + clamp(payload.head, 200) + ' → ' + clamp(payload.base, 200)));
    summary.append(make(documentRef, 'span', clamp(payload.state, 20) + (payload.draft === true ? ' · taslak' : '')));
    if (clamp(payload.body, 2400)) summary.append(make(documentRef, 'p', clamp(payload.body, 2400)));
    const url = clamp(payload.htmlUrl, 500);
    if (/^https:\/\/github\.com\//i.test(url)) {
      const link = make(documentRef, 'a', 'GitHub’da aç') as HTMLAnchorElement;
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; summary.append(link);
    }
    result.append(summary);
  };

  const run = async (kind: 'commit' | 'pull'): Promise<void> => {
    const repo = clamp(repository?.value, 120);
    if (!repo) return report('Önce repository girin.');
    const params = new URLSearchParams({ repository: repo });
    let endpoint = '';
    if (kind === 'commit') {
      const sha = clamp(commitInput.value, 120);
      if (!sha) return report('Commit SHA gerekli.');
      params.set('sha', sha); endpoint = '/api/github/workspace/commit';
    } else {
      const number = clamp(prInput.value, 20);
      if (!number) return report('PR numarası gerekli.');
      params.set('number', number); endpoint = '/api/github/workspace/pull';
    }
    commitButton.disabled = true; prButton.disabled = true;
    report('GitHub ayrıntısı okunuyor…');
    try {
      const payload = await request(endpoint, params);
      if (kind === 'commit') renderCommit(payload); else renderPull(payload);
      report('Ayrıntı okundu.');
    } catch (error) {
      const labels: Record<string, string> = {
        AUTH_REQUIRED: 'GitHub çalışma alanı için oturum gerekli.',
        GITHUB_REPO_NOT_ALLOWED: 'Repository sunucu allowlist’inde değil.',
        GITHUB_ENDPOINT_FAILED: 'GitHub isteği başarısız oldu.',
        INVALID_GITHUB_REF: 'Commit SHA geçersiz.',
        INVALID_GITHUB_ARGUMENTS: 'PR numarası geçersiz.'
      };
      const code = error instanceof Error ? error.message : '';
      report(labels[code] || 'GitHub ayrıntısı okunamadı.');
    } finally {
      commitButton.disabled = false; prButton.disabled = false;
    }
  };

  commitButton.addEventListener('click', () => void run('commit'));
  prButton.addEventListener('click', () => void run('pull'));

  return Object.freeze({ mounted: true, destroy: () => box.remove() });
}

const api = Object.freeze({ mount });
root.HafizeGitHubWorkspaceDetails = api;
const start = (): void => { if (root.document) mount(root.document); };
if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
