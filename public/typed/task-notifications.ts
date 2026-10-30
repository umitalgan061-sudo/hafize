// Background work reports here: rule and scheduled-task answers appear in Settings under "Görev
// sonuçları", and a new one raises a toast plus, if the user allows it, a system notification.
// Nothing asks for permission on its own; only the button in the panel does.

export interface TaskResult { readonly id: string; readonly task: string; readonly ok: boolean; readonly content: string; readonly error: string; readonly createdAt: string; readonly readAt: string | null; }

const POLL_MS = 60_000;
const SEEN_KEY = 'hafize.taskResults.seen.v1';
const ERRORS: Record<string, string> = {
  SCHEDULE_AGENT_RUN_FAILED: 'Görev çalıştırılamadı.',
  SCHEDULE_MODEL_NOT_CONFIGURED: 'Model ayarlı olmadığı için görev çalışmadı.',
  SCHEDULE_AGENT_TASK_CREDENTIAL_BLOCKED: 'Görev metninde parola veya anahtar görüldüğü için durduruldu.',
  SCHEDULE_AGENT_RESULT_CREDENTIAL_BLOCKED: 'Yanıtta parola veya anahtar görüldüğü için gösterilmedi.'
};

/** Short, single-line title for a notification or a list row. */
export function taskTitle(task: unknown, max = 70): string {
  const first = (typeof task === 'string' ? task : '').split(/\r?\n/)[0]?.trim() ?? '';
  if (!first) return 'Arka plan görevi';
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

export function errorText(code: unknown): string {
  return ERRORS[String(code)] ?? 'Görev tamamlanamadı.';
}

/** Results newer than what this browser has already announced, oldest first. */
export function newResults(results: readonly TaskResult[], seen: ReadonlySet<string>): TaskResult[] {
  return results.filter((result) => !result.readAt && !seen.has(result.id)).reverse();
}

export function installTaskNotifications(documentRef: Document, root: typeof globalThis = globalThis): (() => void) | null {
  const toast = documentRef.querySelector<HTMLElement>('#toast');
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const api = (path: string, init?: RequestInit) => ((root as typeof globalThis & { HafizeAuth?: { fetch: typeof fetch } }).HafizeAuth?.fetch ?? root.fetch.bind(root))(path, init);
  const readSeen = () => { try { return new Set<string>(JSON.parse(root.localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set<string>(); } };
  const writeSeen = (seen: Set<string>) => { try { root.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200))); } catch { /* private mode */ } };

  let results: TaskResult[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let panel: HTMLElement | null = null;
  let list: HTMLElement | null = null;
  let permissionRow: HTMLElement | null = null;
  let firstLoad = true;

  const show = (message: string) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    root.setTimeout(() => { if (toast.textContent === message) toast.classList.add('hidden'); }, 6000);
  };
  const notify = (result: TaskResult) => {
    const title = result.ok ? 'Hafize görevi tamamlandı' : 'Hafize görevi başarısız';
    const body = taskTitle(result.task);
    show(`${title}: ${body}`);
    if (typeof root.Notification !== 'function' || root.Notification.permission !== 'granted') return;
    try {
      const notice = new root.Notification(title, { body, tag: result.id, icon: '/hafize.jpeg' });
      notice.onclick = () => { root.focus(); openPanel(); notice.close(); };
    } catch { /* some platforms only allow notifications from a service worker */ }
  };
  const openPanel = () => {
    [...documentRef.querySelectorAll<HTMLElement>('.nav-item')].find((item) => item.textContent?.includes('Ayarlar'))?.click();
    root.setTimeout(() => panel?.scrollIntoView({ block: 'start' }), 300);
  };

  const renderPermission = () => {
    if (!permissionRow) return;
    permissionRow.replaceChildren();
    const support = typeof root.Notification === 'function';
    const state = support ? root.Notification.permission : 'unsupported';
    if (state === 'granted') permissionRow.append(el('span', 'task-note', 'Sistem bildirimleri açık.'));
    else if (state === 'denied') permissionRow.append(el('span', 'task-note', 'Sistem bildirimleri tarayıcıda engelli; açmak için site ayarlarını kullan.'));
    else if (state === 'unsupported') permissionRow.append(el('span', 'task-note', 'Bu tarayıcı sistem bildirimlerini desteklemiyor.'));
    else {
      const ask = el('button', '', 'Sistem bildirimlerini aç');
      ask.type = 'button';
      ask.addEventListener('click', () => { void root.Notification.requestPermission().then(renderPermission); });
      permissionRow.append(ask);
    }
  };
  const renderList = () => {
    if (!list) return;
    list.replaceChildren();
    if (!results.length) { list.append(el('li', 'settings-memory-empty', 'Henüz arka plan görevi çalışmadı.')); return; }
    for (const result of results) {
      const item = el('li', result.ok ? 'task-result' : 'task-result is-failed');
      const head = el('div', 'task-result-head');
      const when = new Date(result.createdAt);
      head.append(el('strong', '', taskTitle(result.task)), el('small', '', Number.isNaN(when.getTime()) ? '' : when.toLocaleString('tr-TR')));
      item.append(head);
      // Agent output goes in as plain text, never as markup.
      const body = el('div', 'task-result-body', result.ok ? result.content || 'Görev tamamlandı, yanıt boş.' : errorText(result.error));
      item.append(body);
      const remove = el('button', 'task-result-remove', 'Sil');
      remove.type = 'button';
      remove.setAttribute('aria-label', `${taskTitle(result.task)} sonucunu sil`);
      remove.addEventListener('click', () => {
        void api(`/api/task-results/${encodeURIComponent(result.id)}`, { method: 'DELETE' }).then((response) => {
          if (response.ok) { results = results.filter((other) => other.id !== result.id); renderList(); }
        });
      });
      item.append(remove);
      list.append(item);
    }
  };

  const refresh = async () => {
    try {
      const response = await api('/api/task-results');
      if (!response.ok) return;
      const data = await response.json();
      results = Array.isArray(data?.results) ? data.results : [];
    } catch { return; }
    const seen = readSeen();
    // Results from before this browser ever looked are history, not news.
    const fresh = firstLoad && !root.localStorage.getItem(SEEN_KEY) ? [] : newResults(results, seen);
    firstLoad = false;
    for (const result of fresh) notify(result);
    for (const result of results) seen.add(result.id);
    writeSeen(seen);
    renderList();
  };

  const attachPanel = (host: Element) => {
    if (host.querySelector('.task-results')) return;
    panel = el('section', 'settings-panel task-results');
    panel.append(el('h2', '', 'Görev sonuçları'), el('p', '', 'Kuralların ve zamanlanmış görevlerin arka planda ürettiği yanıtlar burada toplanır.'));
    permissionRow = el('div', 'settings-actions');
    list = el('ul', 'settings-memory-list task-result-list');
    panel.append(permissionRow, list);
    const voices = host.querySelector('.voice-library');
    const anchor = voices ?? host.querySelector('.settings-panel');
    if (anchor?.nextSibling) host.insertBefore(panel, anchor.nextSibling); else host.append(panel);
    renderPermission();
    renderList();
  };
  const host = documentRef.querySelector('.settings-workspace');
  let watcher: MutationObserver | null = null;
  if (host) attachPanel(host);
  else if (typeof root.MutationObserver === 'function') {
    // settings-workspace.ts builds its page while the app starts; watch once, then stop.
    watcher = new root.MutationObserver(() => {
      const found = documentRef.querySelector('.settings-workspace');
      if (found) { watcher?.disconnect(); watcher = null; attachPanel(found); }
    });
    watcher.observe(documentRef.documentElement, { childList: true, subtree: true });
  }

  void refresh();
  timer = setInterval(() => { void refresh(); }, POLL_MS);
  return () => { if (timer) clearInterval(timer); watcher?.disconnect(); panel?.remove(); };
}

const api = Object.freeze({ errorText, installTaskNotifications, newResults, taskTitle });
(globalThis as typeof globalThis & { HafizeTaskNotifications?: unknown }).HafizeTaskNotifications = api;
if (typeof document !== 'undefined') {
  const start = () => installTaskNotifications(document, globalThis);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
