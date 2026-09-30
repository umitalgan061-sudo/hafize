interface GitHubWorkspaceWriteWindow extends Window {
  HafizeGitHubWorkspaceWrite?: Readonly<{ mount: () => GitHubWorkspaceWriteController | null }>;
}
export interface GitHubWorkspaceWriteController {
  readonly mounted: true;
  readonly destroy: () => void;
}

type WriteAction = 'branch' | 'file' | 'pull';
type WritePayload = Record<string, unknown>;
type ApiRecord = Record<string, unknown>;

const root = globalThis as GitHubWorkspaceWriteWindow;
const CARD_ID = 'githubWorkspaceCard';
const PANEL_CLASS = 'github-workspace-write';
const MAX_REPOSITORY = 120;
const MAX_REF = 200;
const MAX_BRANCH = 200;
const MAX_PATH = 400;
const MAX_CONTENT = 96 * 1024;
const MAX_MESSAGE = 180;
const MAX_TITLE = 240;
const MAX_BODY = 4000;
const HISTORY_KEY = 'hafize.github-workspace-write.v1';
const HISTORY_MAX = 12;
const HISTORY_REPOSITORY = 120;
const HISTORY_TARGET = 240;

interface WriteHistoryEntry {
  readonly action: WriteAction;
  readonly repository: string;
  readonly target: string;
  readonly status: 'ok';
  readonly at: string;
  readonly reference?: string;
}

function make<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  value?: string,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function clamp(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ApiRecord
    : {};
}

function control<T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
  doc: Document,
  tag: 'input' | 'textarea' | 'select',
  label: string,
  value = '',
  className = ''
): T {
  const node = doc.createElement(tag) as T;
  if (className) node.className = className;
  if (tag === 'input' || tag === 'textarea') (node as HTMLInputElement | HTMLTextAreaElement).value = value;
  node.setAttribute('aria-label', label);
  return node;
}

function safeGithubUrl(value: string): boolean {
  return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/.*)?$/i.test(value);
}

function readWriteHistory(): WriteHistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY) || '[]';
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): WriteHistoryEntry[] => {
      if (!item || typeof item !== 'object') return [];
      const value = item as Record<string, unknown>;
      const action = value.action === 'branch' || value.action === 'file' || value.action === 'pull'
        ? value.action
        : null;
      const repository = clamp(value.repository, HISTORY_REPOSITORY);
      const target = clamp(value.target, HISTORY_TARGET);
      const at = clamp(value.at, 40);
      const status = value.status === 'ok' ? 'ok' : null;
      if (!action || !repository || !target || !at || !status) return [];
      const reference = clamp(value.reference, 500);
      return [{ action, repository, target, status, at, ...(reference ? { reference } : {}) }];
    }).slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

function saveWriteHistory(entries: readonly WriteHistoryEntry[]): void {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)));
  } catch {}
}

function actionLabel(action: WriteAction): string {
  return action === 'branch' ? 'Branch' : action === 'file' ? 'Commit' : 'PR';
}

function historyTarget(action: WriteAction, data: ApiRecord): string {
  if (action === 'branch') return clamp(data.branch, HISTORY_TARGET) || 'branch';
  if (action === 'file') return clamp(data.path, HISTORY_TARGET) || 'dosya';
  const number = typeof data.number === 'number' ? String(data.number) : '';
  return number ? '#' + number : clamp(data.title, HISTORY_TARGET) || 'PR';
}

function appendWriteHistory(action: WriteAction, data: ApiRecord): void {
  const repository = clamp(data.repository, HISTORY_REPOSITORY);
  const target = historyTarget(action, data);
  if (!repository || !target) return;
  const reference = action === 'branch'
    ? clamp(data.htmlUrl, 500)
    : action === 'file'
      ? clamp(data.commitUrl, 500)
      : clamp(data.htmlUrl, 500);
  const entry: WriteHistoryEntry = {
    action,
    repository,
    target,
    status: 'ok',
    at: new Date().toISOString(),
    ...(reference ? { reference } : {})
  };
  saveWriteHistory([entry, ...readWriteHistory()
    .filter((item) => !(item.action === action && item.repository === repository && item.target === target))]);
}

function safeHistoryJson(values: readonly WriteHistoryEntry[]): string {
  return JSON.stringify(values.map((item) => ({
    action: item.action,
    repository: item.repository,
    target: item.target,
    status: item.status,
    at: item.at,
    ...(item.reference ? { reference: item.reference } : {})
  })), null, 2);
}

async function copyWriteHistory(values: readonly WriteHistoryEntry[]): Promise<boolean> {
  if (!values.length) return false;
  try {
    await root.navigator?.clipboard?.writeText?.(safeHistoryJson(values));
    return true;
  } catch {
    return false;
  }
}

function renderWriteHistory(
  documentRef: Document,
  host: HTMLElement,
  onClear: () => void,
  selectedAction: 'all' | WriteAction = 'all'
): void {
  host.replaceChildren();
  const head = make(documentRef, 'div', undefined, 'github-write-history-head');
  const heading = make(documentRef, 'strong', 'Son başarılı işlemler');
  heading.id = 'githubWriteHistoryTitle';
  head.append(
    heading,
    // Names exactly what the session history leaves out, matching
    // docs/GITHUB_WRITE_AUDIT.md, instead of a vague "content is not stored".
    make(documentRef, 'span', 'Geçmişte file content, commit body, token ve Authorization saklanmaz', 'github-write-history-note')
  );

  const filter = make(documentRef, 'select', undefined, 'github-write-history-filter') as HTMLSelectElement;
  filter.setAttribute('aria-label', 'Write geçmişi eylem filtresi');
  for (const [value, label] of [
    ['all', 'Tümü'],
    ['branch', 'Branch'],
    ['file', 'Commit'],
    ['pull', 'PR']
  ] as const) {
    const option = make(documentRef, 'option', label);
    option.value = value;
    filter.append(option);
  }
  filter.value = selectedAction;
  head.append(filter);

  const values = readWriteHistory();
  const visible = selectedAction === 'all'
    ? values
    : values.filter((item) => item.action === selectedAction);

  const copy = make(documentRef, 'button', 'Kopyala', 'mini-btn') as HTMLButtonElement;
  copy.type = 'button';
  copy.disabled = !visible.length;
  copy.addEventListener('click', () => {
    void copyWriteHistory(visible).then((ok) => {
      reportWriteHistoryStatus(host, ok ? 'Güvenli işlem geçmişi panoya kopyalandı.' : 'İşlem geçmişi panoya kopyalanamadı.');
    });
  });

  const clear = make(documentRef, 'button', 'Temizle', 'mini-btn') as HTMLButtonElement;
  clear.type = 'button';
  clear.disabled = !values.length;
  clear.addEventListener('click', onClear);
  head.append(copy, clear);
  host.append(head);

  filter.addEventListener('change', () => {
    renderWriteHistory(documentRef, host, onClear, filter.value as 'all' | WriteAction);
  });

  const list = make(documentRef, 'div', undefined, 'github-write-history-list');
  if (!visible.length) {
    list.append(make(
      documentRef,
      'span',
      values.length ? 'Bu filtrede başarılı işlem yok.' : 'Bu oturumda başarılı yazma işlemi yok.',
      'github-write-history-empty'
    ));
    host.append(list);
    return;
  }
  visible.forEach((item) => {
    const row = make(documentRef, 'div', undefined, 'github-write-history-row');
    const top = make(documentRef, 'div', undefined, 'github-write-history-top');
    top.append(
      make(documentRef, 'strong', actionLabel(item.action) + ' · ' + item.target),
      make(documentRef, 'time', new Date(item.at).toLocaleString('tr-TR'), 'github-write-history-time')
    );
    const repo = make(documentRef, 'div', item.repository, 'github-write-history-repo');
    row.append(top, repo);
    if (item.reference && safeGithubUrl(item.reference)) {
      const link = make(documentRef, 'a', 'GitHub’da aç', 'github-write-result-link') as HTMLAnchorElement;
      link.href = item.reference;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      row.append(link);
    }
    list.append(row);
  });
  host.append(list);
}

function reportWriteHistoryStatus(host: HTMLElement, message: string): void {
  const note = host.querySelector<HTMLElement>('.github-write-history-note');
  if (!note) return;
  const previous = note.textContent || 'İçerik saklanmaz';
  note.textContent = message;
  root.setTimeout?.(() => {
    if (note.isConnected) note.textContent = previous;
  }, 2600);
}

function syncRepository(card: HTMLElement, input: HTMLInputElement): void {
  const source = card.querySelector<HTMLInputElement>('input[aria-label="GitHub repository"]');
  if (source && !input.value) input.value = clamp(source.value, MAX_REPOSITORY);
}

function syncReference(card: HTMLElement, input: HTMLInputElement, preferDefault = false): void {
  const source = card.querySelector<HTMLInputElement>('input[aria-label="GitHub branch veya ref"]');
  if (source && (!input.value || preferDefault)) input.value = clamp(source.value, MAX_REF);
}

async function postJson(path: string, body: ApiRecord): Promise<ApiRecord> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body)
  });
  let payload: unknown = {};
  try {
    payload = await response.json();
  } catch {}
  const data = record(payload);
  if (!response.ok) throw new Error(clamp(data.error, 100) || 'GITHUB_WRITE_FAILED');
  return data;
}

function errorLabel(code: string): string {
  const labels: Record<string, string> = {
    AUTH_REQUIRED: 'GitHub yazma işlemi için uygulama oturumu gerekli.',
    CSRF_REQUIRED: 'Güvenlik doğrulaması eksik; sayfayı yenileyip tekrar deneyin.',
    GITHUB_NOT_CONFIGURED: 'Sunucuda GitHub bağlantısı yapılandırılmamış.',
    GITHUB_WRITE_NOT_CONFIGURED: 'GitHub yazma allowlist’i yapılandırılmamış.',
    GITHUB_REPO_NOT_ALLOWED: 'Bu repository yazma allowlist’inde değil.',
    INVALID_GITHUB_REPOSITORY: 'Repository biçimi sahip/depo olmalı.',
    INVALID_GITHUB_REF: 'Branch/ref değeri geçersiz.',
    INVALID_GITHUB_BRANCH: 'Branch adı Git ref kurallarına uymuyor.',
    INVALID_GITHUB_PATH: 'Dosya yolu geçersiz.',
    GITHUB_SENSITIVE_PATH_BLOCKED: 'Credential/secret benzeri dosya yollarına yazılamaz.',
    GITHUB_WORKFLOW_PATH_BLOCKED: 'GitHub Actions workflow dosyalarına bu araçla yazılamaz.',
    GITHUB_CONTENT_CREDENTIAL_BLOCKED: 'İçerik credential/token benzeri veri içeriyor.',
    GITHUB_DEFAULT_BRANCH_BLOCKED: 'Varsayılan branch’e doğrudan commit engellendi; branch + PR akışını kullanın.',
    GITHUB_WRITE_APPROVAL_REQUIRED: 'Yazma işlemi için açık kullanıcı onayı gerekli.',
    GITHUB_WRITE_APPROVAL_EXPIRED: 'Onay süresi doldu; işlemi yeniden onaylayın.',
    GITHUB_WRITE_APPROVAL_MISMATCH: 'Onaylanan plan değişti; yeniden önizleyip onaylayın.',
    GITHUB_WRITE_APPROVAL_REPLAY: 'Bu onay bileti daha önce kullanıldı.',
    GITHUB_ENDPOINT_FAILED: 'GitHub isteği başarısız oldu.',
    GITHUB_WRITE_FAILED: 'GitHub yazma işlemi başarısız oldu.',
    GITHUB_HEAD_MOVED: 'Branch ucu değişmiş; güncel durumu yeniden okuyun.',
    INVALID_GITHUB_ARGUMENTS: 'GitHub yazma parametrelerinden biri geçersiz.',
    INVALID_GITHUB_RESPONSE: 'GitHub beklenmeyen bir yanıt verdi.'
  };
  return labels[code] || 'GitHub yazma işlemi tamamlanamadı.';
}

function createField(
  doc: Document,
  labelText: string,
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  help?: string
): HTMLElement {
  const wrapper = make(doc, 'label', undefined, 'github-write-field');
  wrapper.append(make(doc, 'span', labelText, 'github-write-label'), input);
  if (help) wrapper.append(make(doc, 'small', help, 'github-write-help'));
  return wrapper;
}

function payloadIsUseful(action: WriteAction, values: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): boolean {
  if (!clamp(values.repository?.value, MAX_REPOSITORY)) return false;
  if (action === 'branch') return Boolean(clamp(values.branch?.value, MAX_BRANCH) && clamp(values.fromRef?.value, MAX_REF));
  if (action === 'file') return Boolean(
    clamp(values.branch?.value, MAX_BRANCH) &&
    clamp(values.path?.value, MAX_PATH) &&
    values.content?.value.length &&
    clamp(values.message?.value, MAX_MESSAGE)
  );
  return Boolean(
    clamp(values.head?.value, MAX_BRANCH) &&
    clamp(values.base?.value, MAX_REF) &&
    clamp(values.title?.value, MAX_TITLE)
  );
}

function describePlan(doc: Document, action: WriteAction, payload: WritePayload): HTMLElement {
  const panel = make(doc, 'div', undefined, 'github-write-plan');
  const title = make(doc, 'strong', 'Yazma önizlemesi');
  const rows = make(doc, 'div', undefined, 'github-write-plan-rows');
  const entries: Array<[string, string]> = action === 'branch'
    ? [
      ['Repository', clamp(payload.repository, MAX_REPOSITORY)],
      ['Yeni branch', clamp(payload.branch, MAX_BRANCH)],
      ['Kaynak ref', clamp(payload.fromRef, MAX_REF)]
    ]
    : action === 'file'
      ? [
        ['Repository', clamp(payload.repository, MAX_REPOSITORY)],
        ['Branch', clamp(payload.branch, MAX_BRANCH)],
        ['Dosya', clamp(payload.path, MAX_PATH)],
        ['Commit', clamp(payload.message, MAX_MESSAGE)],
        ['İçerik', String(payload.content ?? '').length.toLocaleString('tr-TR') + ' karakter']
      ]
      : [
        ['Repository', clamp(payload.repository, MAX_REPOSITORY)],
        ['Head', clamp(payload.head, MAX_BRANCH)],
        ['Base', clamp(payload.base, MAX_REF)],
        ['Başlık', clamp(payload.title, MAX_TITLE)],
        ['Taslak', payload.draft === true ? 'Evet' : 'Hayır']
      ];

  for (const [label, value] of entries) {
    const row = make(doc, 'div', undefined, 'github-write-plan-row');
    row.append(make(doc, 'span', label, 'github-write-plan-label'), make(doc, 'strong', value));
    rows.append(row);
  }
  panel.append(title, rows);
  return panel;
}

function mount(documentRef: Document = root.document): GitHubWorkspaceWriteController | null {
  const card = documentRef?.getElementById(CARD_ID);
  if (!documentRef || !card || card.querySelector('.' + PANEL_CLASS)) return null;

  const panel = make(documentRef, 'section', undefined, 'utility-card ' + PANEL_CLASS);
  panel.setAttribute('aria-labelledby', 'githubWriteTitle');
  const heading = make(documentRef, 'div', undefined, 'github-write-head');
  const title = make(documentRef, 'strong', 'GitHub güvenli yazma');
  title.id = 'githubWriteTitle';
  const badge = make(documentRef, 'span', 'kullanıcı onayı + PR odaklı', 'github-write-badge');
  const readiness = make(documentRef, 'span', 'yazma durumu kontrol ediliyor…', 'github-write-readiness');
  heading.append(title, badge, readiness);

  const intro = make(
    documentRef,
    'p',
    'Branch oluştur, tek dosya commit et veya mevcut branch’lerden PR aç. Varsayılan branch’e doğrudan commit ve secret/workflow yolları engellenir.',
    'github-write-intro'
  );

  const actionSelect = control<HTMLSelectElement>(documentRef, 'select', 'GitHub yazma eylemi');
  actionSelect.append(
    Object.entries({
      branch: 'Branch oluştur',
      file: 'Dosya commit et',
      pull: 'Pull request aç'
    }).map(([value, label]) => {
      const option = make(documentRef, 'option', label);
      option.value = value;
      return option;
    })
  );

  const form = make(documentRef, 'div', undefined, 'github-write-form');
  const planHost = make(documentRef, 'div', undefined, 'github-write-plan-host');
  const approval = documentRef.createElement('input');
  approval.type = 'checkbox';
  approval.setAttribute('aria-label', 'GitHub yazma işlemini onaylıyorum');
  const approvalLabel = make(documentRef, 'label', undefined, 'github-write-approval');
  const approvalText = make(
    documentRef,
    'span',
    'Bu planın GitHub repository’sinde değişiklik yapacağını okudum ve açıkça onaylıyorum.'
  );
  approvalLabel.append(approval, approvalText);

  const execute = make(documentRef, 'button', 'Onayla ve yürüt', 'soft-btn') as HTMLButtonElement;
  execute.type = 'button';
  execute.disabled = true;
  const cancel = make(documentRef, 'button', 'Temizle', 'mini-btn') as HTMLButtonElement;
  cancel.type = 'button';
  const status = make(documentRef, 'div', '', 'github-write-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const result = make(documentRef, 'div', '', 'github-write-result');
  result.setAttribute('aria-live', 'polite');

  const actions = make(documentRef, 'div', undefined, 'github-write-actions');
  actions.append(execute, cancel);
  panel.append(heading, intro, actionSelect, form, planHost, approvalLabel, actions, status, result, historyHost);
  card.append(panel);

  let destroyed = false;
  let writeConfigured = true;
  let fieldValues: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};
  let refreshPlan: () => void = () => {};

  const historyHost = make(documentRef, 'section', undefined, 'github-write-history');
  historyHost.setAttribute('aria-labelledby', 'githubWriteHistoryTitle');
  const historyHeading = make(documentRef, 'strong', 'Son başarılı işlemler');
  historyHeading.id = 'githubWriteHistoryTitle';
  historyHost.append(historyHeading);

  const report = (message: string): void => {
    status.textContent = clamp(message, 260);
  };

  approval.addEventListener('change', () => refreshPlan());
  const buildFields = (): void => {
    form.replaceChildren();
    planHost.replaceChildren();
    execute.disabled = true;
    approval.checked = false;
    result.replaceChildren();
    const action = actionSelect.value as WriteAction;
    const repository = control<HTMLInputElement>(documentRef, 'input', 'GitHub repository', '');
    repository.type = 'text';
    repository.maxLength = MAX_REPOSITORY;
    repository.placeholder = 'sahip/depo';
    syncRepository(card, repository);

    const common: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = { repository };

    if (action === 'branch') {
      const fromRef = control<HTMLInputElement>(documentRef, 'input', 'Kaynak ref');
      fromRef.type = 'text';
      fromRef.maxLength = MAX_REF;
      fromRef.placeholder = 'main veya commit SHA';
      syncReference(card, fromRef, true);
      const branch = control<HTMLInputElement>(documentRef, 'input', 'Yeni branch');
      branch.type = 'text';
      branch.maxLength = MAX_BRANCH;
      branch.placeholder = 'hafize/feature-adi';
      common.fromRef = fromRef;
      common.branch = branch;
      form.append(
        createField(documentRef, 'Repository', repository),
        createField(documentRef, 'Kaynak ref', fromRef),
        createField(documentRef, 'Yeni branch', branch, 'Branch oluşturulur; mevcut branch üzerine yazılmaz.')
      );
    } else if (action === 'file') {
      const branch = control<HTMLInputElement>(documentRef, 'input', 'Commit branch');
      branch.type = 'text';
      branch.maxLength = MAX_BRANCH;
      branch.placeholder = 'feature/branch';
      syncReference(card, branch);
      const path = control<HTMLInputElement>(documentRef, 'input', 'GitHub dosya yolu');
      path.type = 'text';
      path.maxLength = MAX_PATH;
      path.placeholder = 'src/example.ts';
      const message = control<HTMLInputElement>(documentRef, 'input', 'Commit mesajı');
      message.type = 'text';
      message.maxLength = MAX_MESSAGE;
      message.placeholder = 'feat: ...';
      const existingSha = control<HTMLInputElement>(documentRef, 'input', 'Mevcut dosya SHA');
      existingSha.type = 'text';
      existingSha.maxLength = 80;
      existingSha.placeholder = 'Yalnız mevcut dosyayı güncellemek için';
      const content = control<HTMLTextAreaElement>(documentRef, 'textarea', 'Commit içeriği');
      content.maxLength = MAX_CONTENT;
      content.rows = 10;
      content.placeholder = 'Dosya içeriği…';
      common.branch = branch;
      common.path = path;
      common.message = message;
      common.existingSha = existingSha;
      common.content = content;
      form.append(
        createField(documentRef, 'Repository', repository),
        createField(documentRef, 'Branch', branch),
        createField(documentRef, 'Dosya yolu', path, 'Secret, credential ve .github/workflows yolları engellenir.'),
        createField(documentRef, 'Commit mesajı', message),
        createField(documentRef, 'Mevcut dosya SHA', existingSha, 'Yeni dosya için boş bırakılır.'),
        createField(documentRef, 'İçerik', content, 'En fazla 96 KB; plaintext credential/token tespiti uygulanır.')
      );
    } else {
      const head = control<HTMLInputElement>(documentRef, 'input', 'PR head branch');
      head.type = 'text';
      head.maxLength = MAX_BRANCH;
      head.placeholder = 'feature/branch';
      syncReference(card, head);
      const base = control<HTMLInputElement>(documentRef, 'input', 'PR base ref');
      base.type = 'text';
      base.maxLength = MAX_REF;
      base.placeholder = 'main';
      const prTitle = control<HTMLInputElement>(documentRef, 'input', 'PR başlığı');
      prTitle.type = 'text';
      prTitle.maxLength = MAX_TITLE;
      prTitle.placeholder = 'feat: ...';
      const prBody = control<HTMLTextAreaElement>(documentRef, 'textarea', 'PR açıklaması');
      prBody.maxLength = MAX_BODY;
      prBody.rows = 7;
      prBody.placeholder = 'Ne değişti, neden, doğrulama ve geri alma bilgisi…';
      const draft = control<HTMLSelectElement>(documentRef, 'select', 'PR taslak mı');
      const yes = make(documentRef, 'option', 'Taslak');
      yes.value = 'true';
      const no = make(documentRef, 'option', 'Hazır');
      no.value = 'false';
      draft.append(yes, no);
      common.head = head;
      common.base = base;
      common.title = prTitle;
      common.body = prBody;
      common.draft = draft;
      form.append(
        createField(documentRef, 'Repository', repository),
        createField(documentRef, 'Head branch', head),
        createField(documentRef, 'Base ref', base, 'Head ve base aynı olamaz.'),
        createField(documentRef, 'PR başlığı', prTitle),
        createField(documentRef, 'PR açıklaması', prBody),
        createField(documentRef, 'Durum', draft)
      );
    }

    fieldValues = common;

    const updatePlan = (): void => {
      const valid = payloadIsUseful(action, fieldValues);
      execute.disabled = !valid || !approval.checked;
      planHost.replaceChildren();
      const payload = buildPayload(action, fieldValues);
      if (valid) planHost.append(describePlan(documentRef, action, payload));
      else planHost.append(make(documentRef, 'div', 'Planı yürütmek için zorunlu alanları doldur.', 'github-write-plan-empty'));
    };

    Object.values(fieldValues).forEach((field) => field.addEventListener('input', updatePlan));
    Object.values(fieldValues).forEach((field) => field.addEventListener('change', updatePlan));
    refreshPlan = updatePlan;
    updatePlan();
    repository.focus();
  };

  const buildPayload = (action: WriteAction, values: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): WritePayload => {
    const repository = clamp(values.repository?.value, MAX_REPOSITORY);
    if (action === 'branch') {
      return {
        repository,
        branch: clamp(values.branch?.value, MAX_BRANCH),
        fromRef: clamp(values.fromRef?.value, MAX_REF)
      };
    }
    if (action === 'file') {
      return {
        repository,
        branch: clamp(values.branch?.value, MAX_BRANCH),
        path: clamp(values.path?.value, MAX_PATH),
        message: clamp(values.message?.value, MAX_MESSAGE),
        existingSha: clamp(values.existingSha?.value, 80),
        content: String(values.content?.value || '').slice(0, MAX_CONTENT)
      };
    }
    return {
      repository,
      head: clamp(values.head?.value, MAX_BRANCH),
      base: clamp(values.base?.value, MAX_REF),
      title: clamp(values.title?.value, MAX_TITLE),
      body: String(values.body?.value || '').slice(0, MAX_BODY),
      draft: values.draft?.value === 'true'
    };
  };

  const executeWrite = async (): Promise<void> => {
    const action = actionSelect.value as WriteAction;
    if (!writeConfigured) {
      report('Sunucuda GitHub yazma yetkisi etkin değil.');
      return;
    }
    const payload = buildPayload(action, fieldValues);
    if (!payloadIsUseful(action, fieldValues)) {
      report('Zorunlu alanları doldurun.');
      return;
    }
    if (!approval.checked) {
      report('Önce açık kullanıcı onayı vermelisiniz.');
      return;
    }
    execute.disabled = true;
    cancel.disabled = true;
    actionSelect.disabled = true;
    report('Onay bileti hazırlanıyor…');
    result.replaceChildren();
    try {
      const approvalResult = await postJson('/api/github/workspace/write/approval', {
        action,
        approved: true,
        payload
      });
      const ticket = clamp(approvalResult.ticket, 128);
      if (!ticket) throw new Error('GITHUB_WRITE_APPROVAL_REQUIRED');
      report('Onay bileti tek kullanımlık ve kısa ömürlü. GitHub yazılıyor…');
      const written = await postJson('/api/github/workspace/write', {
        action,
        ticket,
        payload
      });
      if (destroyed) return;
      renderResult(action, written);
      appendWriteHistory(action, written);
      renderWriteHistory(documentRef, historyHost, () => {
        saveWriteHistory([]);
        renderWriteHistory(documentRef, historyHost, () => {});
      });
      report('GitHub yazma işlemi tamamlandı.');
      approval.checked = false;
    } catch (error) {
      report(error instanceof Error ? errorLabel(error.message) : 'GitHub yazma işlemi tamamlanamadı.');
    } finally {
      if (!destroyed) {
        execute.disabled = false;
        cancel.disabled = false;
        actionSelect.disabled = false;
        syncControlState();
      }
    }
  };

  const syncControlState = (): void => {
    execute.disabled = !payloadIsUseful(actionSelect.value as WriteAction, fieldValues) || !approval.checked;
  };

  const renderResult = (action: WriteAction, data: ApiRecord): void => {
    result.replaceChildren();
    const box = make(documentRef, 'div', undefined, 'github-write-result-box');
    const headline = action === 'branch'
      ? 'Branch oluşturuldu'
      : action === 'file'
        ? 'Commit oluşturuldu'
        : 'Pull request oluşturuldu';
    box.append(make(documentRef, 'strong', headline));
    if (action === 'branch') {
      box.append(
        make(documentRef, 'div', clamp(data.repository, MAX_REPOSITORY) + ' · ' + clamp(data.branch, MAX_BRANCH), 'github-write-result-meta'),
        make(documentRef, 'div', 'Kaynak SHA: ' + clamp(data.fromSha, 80), 'github-write-result-meta')
      );
      const url = clamp(data.htmlUrl, 500);
      if (safeGithubUrl(url)) {
        const link = make(documentRef, 'a', 'GitHub’da aç', 'github-write-result-link') as HTMLAnchorElement;
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        box.append(link);
      }
      const refInput = card.querySelector<HTMLInputElement>('input[aria-label="GitHub branch veya ref"]');
      if (refInput) refInput.value = clamp(data.branch, MAX_REF);
    } else if (action === 'file') {
      box.append(
        make(documentRef, 'div', clamp(data.repository, MAX_REPOSITORY) + ' · ' + clamp(data.path, MAX_PATH), 'github-write-result-meta'),
        make(documentRef, 'div', 'Commit SHA: ' + clamp(data.commitSha, 80), 'github-write-result-meta')
      );
      const url = clamp(data.commitUrl, 500);
      if (safeGithubUrl(url)) {
        const link = make(documentRef, 'a', 'Commit’i GitHub’da aç', 'github-write-result-link') as HTMLAnchorElement;
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        box.append(link);
      }
    } else {
      box.append(
        make(documentRef, 'div', '#' + String(data.number ?? '') + ' · ' + clamp(data.title, MAX_TITLE), 'github-write-result-meta'),
        make(documentRef, 'div', clamp(data.head, MAX_BRANCH) + ' → ' + clamp(data.base, MAX_REF), 'github-write-result-meta')
      );
      const url = clamp(data.htmlUrl, 500);
      if (safeGithubUrl(url)) {
        const link = make(documentRef, 'a', 'PR’ı GitHub’da aç', 'github-write-result-link') as HTMLAnchorElement;
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        box.append(link);
      }
    }
    result.append(box);
  };

  const reset = (): void => {
    buildFields();
    report('Yazma planı temizlendi.');
  };

  actionSelect.addEventListener('change', buildFields);
  execute.addEventListener('click', () => void executeWrite());
  cancel.addEventListener('click', reset);
  const checkWriteReadiness = async (): Promise<void> => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const payload = record(await response.json().catch(() => ({})));
      if (destroyed) return;
      writeConfigured = response.ok && payload.githubWriteConfigured === true;
      readiness.textContent = writeConfigured ? 'yazma hazır' : 'yazma kapalı';
      readiness.setAttribute('aria-label', writeConfigured
        ? 'GitHub yazma bağlantısı hazır'
        : 'GitHub yazma bağlantısı yapılandırılmamış');
      if (!writeConfigured) {
        execute.disabled = true;
        report('GitHub yazma allowlist’i etkin değil. Read-only çalışma alanı kullanılabilir.');
      } else {
        syncControlState();
      }
    } catch {
      if (destroyed) return;
      readiness.textContent = 'durum alınamadı';
      readiness.setAttribute('aria-label', 'GitHub yazma durumu alınamadı');
      writeConfigured = true;
      report('Yazma durumu doğrulanamadı; server isteği ayrıca doğrulayacaktır.');
    }
  };

  buildFields();
  void checkWriteReadiness();
  renderWriteHistory(documentRef, historyHost, () => {
    saveWriteHistory([]);
    renderWriteHistory(documentRef, historyHost, () => {});
  });

  return Object.freeze({
    mounted: true,
    destroy: () => {
      destroyed = true;
      panel.remove();
    }
  });
}

let attempts = 0;
const boot = (): void => {
  if (root.document?.getElementById(CARD_ID)) {
    mount(root.document);
    return;
  }
  if (attempts >= 20) return;
  attempts += 1;
  root.setTimeout(boot, 50);
};
if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

const api = Object.freeze({ mount });
root.HafizeGitHubWorkspaceWrite = api;
export { api as HafizeGitHubWorkspaceWrite };
