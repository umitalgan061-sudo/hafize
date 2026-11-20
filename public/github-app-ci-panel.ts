interface CiRun {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly conclusion: string;
  readonly headSha: string;
  readonly branch: string;
  readonly htmlUrl: string;
}

type CiResponse = Record<string, unknown>;
type CiWindow = Window & { HafizeGithubCiPanel?: Readonly<{ mount: () => void }> };

const root = globalThis as CiWindow;
const REPO_PATTERN = /^[A-Za-z0-9_.-]{1,100}[/][A-Za-z0-9_.-]{1,100}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const labels: Readonly<Record<string, string>> = Object.freeze({
  AUTH_REQUIRED: 'GitHub kontrollerini görmek için oturum aç.',
  GITHUB_APP_NOT_CONFIGURED: 'GitHub App henüz sunucuda yapılandırılmamış.',
  GITHUB_CI_REPO_NOT_ALLOWED: 'Bu depoya erişim izni verilmemiş.',
  GITHUB_APP_AUTH_FAILED: 'GitHub App kimlik doğrulaması başarısız.',
  GITHUB_CI_ENDPOINT_FAILED: 'GitHub kontrollerine ulaşılamadı.',
  GITHUB_CI_INVALID_REF: 'Branch adı geçersiz.',
  GITHUB_CI_INVALID_SHA: 'Commit SHA geçersiz.'
});

function node<K extends keyof HTMLElementTagNameMap>(
  doc: Document, tag: K, value?: string, className?: string
): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  if (value !== undefined) element.textContent = value;
  if (className) element.className = className;
  return element;
}

function small(value: unknown, length = 180): string {
  return typeof value === 'string' ? value.slice(0, length) : '';
}

function record(value: unknown): CiResponse {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as CiResponse : {};
}

async function query(params: URLSearchParams): Promise<CiResponse> {
  const response = await fetch('/api/github/app/ci?' + params.toString(), {
    credentials: 'same-origin',
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = small(record(payload).error, 80);
    throw new Error(labels[reason] || 'GitHub kontrol sorgusu başarısız.');
  }
  return record(payload);
}

function mount(doc: Document = root.document): void {
  const card = doc?.getElementById('githubWorkspaceCard');
  if (!card || card.querySelector('#githubAppCiPanel')) return;

  const repositoryInput = [...card.querySelectorAll<HTMLInputElement>('input')]
    .find((input) => input.getAttribute('aria-label') === 'GitHub repository');
  const branchInput = [...card.querySelectorAll<HTMLInputElement>('input')]
    .find((input) => input.getAttribute('aria-label') === 'GitHub branch veya ref');
  if (!repositoryInput || !branchInput) return;

  const panel = node(doc, 'section', undefined, 'github-workspace-summary');
  panel.id = 'githubAppCiPanel';
  panel.setAttribute('aria-label', 'GitHub App CI durumu');

  const title = node(doc, 'strong', 'GitHub CI · App');
  const info = node(doc, 'span', 'İsteğe bağlı: GitHub Actions ve Checks', 'github-workspace-meta');
  const refresh = node(doc, 'button', 'CI durumunu getir', 'mini-btn');
  refresh.type = 'button';
  const status = node(doc, 'div', 'Sorgu başlatılmadı.', 'github-workspace-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const list = node(doc, 'div', undefined, 'github-workspace-list');
  panel.append(title, info, refresh, status, list);
  card.append(panel);

  let generation = 0;
  let destroyed = false;

  async function readDetails(repo: string, run: CiRun, holder: HTMLElement, action: 'jobs' | 'checks'): Promise<void> {
    const current = ++generation;
    holder.replaceChildren(node(doc, 'span', 'Kontroller okunuyor…', 'github-workspace-meta'));
    try {
      const params = new URLSearchParams({ repository: repo, action });
      if (action === 'jobs') params.set('runId', String(run.id));
      else params.set('sha', run.headSha);
      const payload = await query(params);
      if (destroyed || current !== generation) return;
      holder.replaceChildren();
      const entries = payload[action] as unknown;
      if (!Array.isArray(entries) || !entries.length) {
        holder.append(node(doc, 'span', 'Kayıt bulunamadı.', 'github-workspace-meta'));
        return;
      }
      for (const raw of entries.slice(0, 30)) {
        const item = record(raw);
        holder.append(node(doc, 'div',
          small(item.name, 120) + ' · ' + small(item.conclusion || item.status, 30),
          'github-workspace-meta'));
      }
    } catch (error) {
      if (!destroyed && current === generation) {
        holder.replaceChildren(node(doc, 'span',
          error instanceof Error ? error.message : 'Kontroller okunamadı.',
          'github-workspace-meta'));
      }
    }
  }

  async function load(): Promise<void> {
    const repo = repositoryInput!.value.trim().toLowerCase();
    const branch = branchInput!.value.trim();
    if (!REPO_PATTERN.test(repo)) {
      status.textContent = 'Depoyu sahip/depo biçiminde gir.';
      return;
    }
    if (branch.length > 180 || branch.includes('..') || branch.includes('//')) {
      status.textContent = 'Branch geçersiz.';
      return;
    }
    const current = ++generation;
    refresh.disabled = true;
    status.textContent = 'GitHub kontrolleri okunuyor…';
    list.replaceChildren();
    try {
      const params = new URLSearchParams({ action: 'runs', repository: repo, limit: '10' });
      if (branch) params.set('branch', branch);
      const payload = await query(params);
      if (destroyed || current !== generation) return;
      const runs = payload.runs as unknown;
      if (!Array.isArray(runs) || !runs.length) {
        status.textContent = 'Bu depo için CI çalışması bulunamadı.';
        return;
      }
      for (const raw of runs.slice(0, 10)) {
        const run = record(raw) as unknown as CiRun;
        if (!Number.isSafeInteger(run.id) || run.id < 1) continue;
        const row = node(doc, 'article', undefined, 'github-workspace-row');
        const details = node(doc, 'div', undefined, 'github-workspace-list');
        const summary = node(doc, 'div', undefined, 'github-workspace-meta');
        summary.textContent = small(run.name, 120) + ' · ' + small(run.conclusion || run.status, 30);
        row.append(summary);
        const url = 'https://github.com/' + repo + '/actions/runs/' + run.id;
        const anchor = node(doc, 'a', 'GitHub’da görüntüle', 'github-workspace-link');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        row.append(anchor);
        const jobs = node(doc, 'button', 'İşleri göster', 'mini-btn');
        jobs.type = 'button';
        jobs.addEventListener('click', () => void readDetails(repo, run, details, 'jobs'));
        row.append(jobs);
        if (SHA_PATTERN.test(small(run.headSha, 40))) {
          const checks = node(doc, 'button', 'Kontroller', 'mini-btn');
          checks.type = 'button';
          checks.addEventListener('click', () => void readDetails(repo, run, details, 'checks'));
          row.append(checks);
        }
        row.append(details);
        list.append(row);
      }
      status.textContent = 'Son CI çalışmaları listelendi.';
    } catch (error) {
      if (!destroyed && current === generation) {
        status.textContent = error instanceof Error ? error.message : 'CI sonuçları okunamadı.';
      }
    } finally {
      if (!destroyed && current === generation) refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', () => void load());
  // No automatic GitHub requests on page load: the user chooses when to fetch.
  root.addEventListener('pagehide', () => { destroyed = true; generation++; }, { once: true });
}

root.HafizeGithubCiPanel = Object.freeze({ mount: () => mount() });
const start = (): void => { if (root.document) mount(root.document); };
if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
