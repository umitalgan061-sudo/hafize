interface GitHubWorkspaceActionsWindow extends Window {
  HafizeGitHubWorkspaceActions?: Readonly<{ mount: () => GitHubWorkspaceActionsController | null }>;
}

export interface GitHubWorkspaceActionsController {
  readonly mounted: true;
  readonly destroy: () => void;
}

const root = globalThis as GitHubWorkspaceActionsWindow;
const CARD_ID = 'githubWorkspaceCard';
const HISTORY_KEY = 'hafize.github-workspace.history.v1';
const MAX_HISTORY = 6;
const MAX_REPOSITORY = 120;

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, value?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function clamp(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function readHistory(): string[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY) || '[]';
    const values = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    return values.filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim().slice(0, MAX_REPOSITORY))
      .filter(Boolean)
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function writeHistory(values: readonly string[]): void {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(values.slice(0, MAX_HISTORY)));
  } catch {}
}

function remember(repository: string): void {
  const normalized = clamp(repository, MAX_REPOSITORY);
  if (!normalized) return;
  const next = [normalized, ...readHistory().filter((value) => value.toLowerCase() !== normalized.toLowerCase())]
    .slice(0, MAX_HISTORY);
  writeHistory(next);
}

function safeGithubUrl(url: string): boolean {
  return /^https:\/\/github\.com\//i.test(url);
}

function mount(documentRef: Document = root.document): GitHubWorkspaceActionsController | null {
  const card = documentRef?.getElementById(CARD_ID);
  if (!documentRef || !card || card.querySelector('.github-workspace-actions')) return null;

  const repository = [...card.querySelectorAll<HTMLInputElement>('input')]
    .find((input) => input.getAttribute('aria-label') === 'GitHub repository');
  const ref = [...card.querySelectorAll<HTMLInputElement>('input')]
    .find((input) => input.getAttribute('aria-label') === 'GitHub branch veya ref');
  const result = card.querySelector<HTMLElement>('.github-workspace-result');
  const status = card.querySelector<HTMLElement>('.github-workspace-status');
  if (!repository || !ref || !result) return null;

  const panel = make(documentRef, 'div', undefined, 'github-workspace-actions');
  panel.setAttribute('aria-label', 'GitHub hızlı işlemleri');

  const refresh = make(documentRef, 'button', 'Yenile', 'mini-btn') as HTMLButtonElement;
  refresh.type = 'button';
  const copy = make(documentRef, 'button', 'Görüneni kopyala', 'mini-btn') as HTMLButtonElement;
  copy.type = 'button';

  const state = make(documentRef, 'select', undefined, 'github-workspace-state') as HTMLSelectElement;
  state.setAttribute('aria-label', 'PR durum filtresi');
  for (const [value, label] of [['open', 'Açık PR'], ['closed', 'Kapalı PR'], ['all', 'Tüm PR']]) {
    const option = make(documentRef, 'option', label);
    option.value = value;
    state.append(option);
  }

  const history = make(documentRef, 'div', undefined, 'github-workspace-history');
  history.setAttribute('aria-label', 'Son repositoryler');

  panel.append(refresh, copy, state, history);
  card.querySelector('.github-workspace-form')?.after(panel);

  const report = (message: string): void => {
    if (status) status.textContent = clamp(message, 220);
  };

  const coreLoadButton = card.querySelector<HTMLButtonElement>('.github-workspace-form button');
  const coreTabs = [...card.querySelectorAll<HTMLButtonElement>('[data-github-workspace-action]')];

  const loadCore = (): void => {
    coreLoadButton?.click();
  };

  const renderHistory = (): void => {
    history.replaceChildren();
    const values = readHistory();
    if (!values.length) {
      history.append(make(documentRef, 'span', 'Bu oturumda repository geçmişi yok.', 'github-workspace-history-empty'));
      return;
    }
    values.forEach((value) => {
      const chip = make(documentRef, 'button', value, 'mini-btn github-workspace-history-item') as HTMLButtonElement;
      chip.type = 'button';
      chip.title = value;
      chip.setAttribute('aria-label', value + ' repository’sini yükle');
      chip.addEventListener('click', () => {
        repository.value = value;
        ref.value = '';
        report(value + ' repository seçildi.');
        loadCore();
      });
      history.append(chip);
    });
  };

  const recordCurrentRepo = (): void => {
    const value = clamp(repository.value, MAX_REPOSITORY);
    if (!value) return;
    remember(value);
    renderHistory();
  };

  const onRepositoryChange = (): void => recordCurrentRepo();

  repository.addEventListener('change', onRepositoryChange);
  repository.addEventListener('blur', onRepositoryChange);

  refresh.addEventListener('click', () => {
    recordCurrentRepo();
    loadCore();
  });

  state.addEventListener('change', () => {
    const tab = card.querySelector<HTMLButtonElement>('[data-github-workspace-action="pulls"]');
    tab?.click();
    recordCurrentRepo();
    const url = new URL('/api/github/workspace', root.location?.origin || window.location.origin);
    url.searchParams.set('action', 'pulls');
    url.searchParams.set('repository', clamp(repository.value, MAX_REPOSITORY));
    url.searchParams.set('state', state.value);
    url.searchParams.set('limit', '30');
    state.disabled = true;
    fetch(url.pathname + '?' + url.searchParams.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(clamp((payload as Record<string, unknown>).error, 100) || 'GITHUB_WORKSPACE_FAILED');
      const pulls = Array.isArray((payload as Record<string, unknown>).pullRequests)
        ? (payload as Record<string, unknown>).pullRequests
        : [];
      result.replaceChildren();
      const list = make(documentRef, 'div', undefined, 'github-workspace-list');
      if (!pulls.length) list.append(make(documentRef, 'span', 'PR bulunamadı.', 'github-workspace-empty'));
      for (const raw of pulls) {
        if (!raw || typeof raw !== 'object') continue;
        const pull = raw as Record<string, unknown>;
        const row = make(documentRef, 'article', undefined, 'github-workspace-row');
        row.append(make(documentRef, 'strong', '#' + String(pull.number ?? '') + ' · ' + clamp(pull.title, 220)));
        row.append(make(documentRef, 'div', clamp(pull.author, 120) + ' · ' + clamp(pull.head, 200) + ' → ' + clamp(pull.base, 200), 'github-workspace-meta'));
        const link = clamp(pull.htmlUrl, 500);
        if (safeGithubUrl(link)) {
          const anchor = make(documentRef, 'a', 'Aç', 'github-workspace-link') as HTMLAnchorElement;
          anchor.href = link;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          row.append(anchor);
        }
        list.append(row);
      }
      result.append(list);
      report(state.options[state.selectedIndex]?.textContent + ' yüklendi.');
      recordCurrentRepo();
    }).catch((error) => {
      report(error instanceof Error ? error.message : 'GitHub PR listesi okunamadı.');
    }).finally(() => {
      state.disabled = false;
    });
  });

  copy.addEventListener('click', async () => {
    const text = result.textContent?.trim() || '';
    if (!text) return report('Kopyalanacak sonuç yok.');
    try {
      await root.navigator?.clipboard?.writeText?.(text);
      report('Görünen sonuç panoya kopyalandı.');
    } catch {
      report('Görünen sonuç panoya kopyalanamadı.');
    }
  });

  const onLoaded = (): void => recordCurrentRepo();
  coreTabs.forEach((tab) => tab.addEventListener('click', onLoaded));
  renderHistory();

  return Object.freeze({
    mounted: true,
    destroy: () => {
      repository.removeEventListener('change', onRepositoryChange);
      repository.removeEventListener('blur', onRepositoryChange);
      panel.remove();
    }
  });
}

const api = Object.freeze({ mount });
root.HafizeGitHubWorkspaceActions = api;
const start = (): void => { if (root.document) mount(root.document); };
if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
