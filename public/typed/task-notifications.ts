// Background work reports here: rule and scheduled-task answers appear in Settings under "Görev
// sonuçları", and a new one raises a toast plus, if the user allows it, a system notification.
// Nothing asks for permission on its own; only the button in the panel does.

export interface TaskResult { readonly id: string; readonly task: string; readonly ok: boolean; readonly content: string; readonly error: string; readonly createdAt: string; readonly readAt: string | null; }

const POLL_MS = 60_000;
// A list of a thousand results was a thousand rows to build and scroll past on a phone.
const SHOWN_AT_FIRST = 20;
const SEEN_KEY = 'hafize.taskResults.seen.v1';
// The owner's "no notices" choice, shared with the Hafize layer (hafize-uyum), which sets it from Settings or the chat.
export const MUTED_KEY = 'hafize.bildirim.kapali';
// As many ids as the worker keeps results (1000), with room to spare. Remembering only 200 of them made every other
// unread result look new again each minute: with a full list that was 800 notices a minute, for ever (2026-11-11).
const MAX_SEEN = 3000;
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

const MAX_IN_ONE_NOTICE = 8;
const MAX_NOTICE_CHARS = 6000;
/** The conversation a group of results is told in: its id (the same on every device), title and what Hafize says. */
export function noticeChat(results: readonly TaskResult[], locale = 'tr-TR'): { id: string; title: string; content: string; ids: string[] } | null {
  if (!results.length) return null;
  const newestFirst = [...results].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const shown = newestFirst.slice(0, MAX_IN_ONE_NOTICE);
  const when = (result: TaskResult) => { const date = new Date(result.createdAt); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); };
  const body = (result: TaskResult) => (result.ok ? (result.content || 'Görev tamamlandı, yanıt boş.') : `Bu görev tamamlanamadı: ${errorText(result.error)}`).slice(0, MAX_NOTICE_CHARS);
  const one = (result: TaskResult) => `**Görev:** ${taskTitle(result.task, 160)}\n**Ne zaman:** ${when(result)}\n**Sonuç:** ${result.ok ? 'tamamlandı' : 'başarısız'}\n\n${body(result)}`;
  const content = shown.length === 1
    ? `Arka planda yürüttüğüm bir görev bitti.\n\n${one(shown[0])}`
    : `Arka planda yürüttüğüm ${results.length} görevin sonucu geldi${results.length > shown.length ? `; en yeni ${shown.length} tanesi aşağıda, hepsi Ayarlar > Görev sonuçları'nda` : ''}.\n\n${shown.map((result, index) => `### ${index + 1}. ${taskTitle(result.task, 80)}\n${one(result)}`).join('\n\n---\n\n')}`;
  return { id: `bildirim-${newestFirst[0].id}`, title: shown.length === 1 ? taskTitle(shown[0].task, 60) : `${results.length} görev sonucu`, content, ids: results.map((result) => result.id) };
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
  const writeSeen = (seen: Set<string>) => { try { root.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-MAX_SEEN))); } catch { /* private mode */ } };
  const muted = () => { try { return root.localStorage.getItem(MUTED_KEY) === '1'; } catch { return false; } };

  let results: TaskResult[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let panel: HTMLElement | null = null;
  let list: HTMLElement | null = null;
  let permissionRow: HTMLElement | null = null;
  let firstLoad = true;
  let showAll = false;
  let toolbar: HTMLElement | null = null;
  const ask = (message: string): Promise<boolean> => {
    const themed = (root as typeof globalThis & { HafizeAsk?: { confirm(message: string, options?: Record<string, unknown>): Promise<boolean | null> } }).HafizeAsk;
    return themed ? themed.confirm(message, { ok: 'Temizle', danger: true }).then(Boolean) : Promise.resolve(root.confirm(message));
  };
  const renderToolbar = () => {
    if (!toolbar) return;
    toolbar.replaceChildren();
    if (!results.length) return;
    toolbar.append(el('span', 'task-note', `${results.length} sonuç`));
    const clear = el('button', '', 'Tümünü temizle');
    clear.type = 'button';
    clear.addEventListener('click', () => {
      void ask(`${results.length} görev sonucunun hepsi silinsin mi? Bu geri alınamaz.`).then(async (yes) => {
        if (!yes) return;
        const response = await api('/api/task-results', { method: 'DELETE' }).catch(() => null);
        if (!response?.ok) { show('Görev sonuçları temizlenemedi.'); return; }
        results = [];
        showAll = false;
        renderList();
        show('Görev sonuçları temizlendi.');
      });
    });
    toolbar.append(clear);
  };

  const show = (message: string) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    root.setTimeout(() => { if (toast.textContent === message) toast.classList.add('hidden'); }, 6000);
  };
  // One notice however many results came in together: the list in Settings has each of them.
  const send = (detail: Record<string, unknown>) => { root.dispatchEvent?.(new CustomEvent('hafize:notice-chat', { detail })); return detail; };
  /** The results told in a conversation of their own; true when it was made (or was there already). */
  const tell = (fresh: readonly TaskResult[], open: boolean): boolean => {
    const chat = noticeChat(fresh);
    if (!chat) return false;
    const detail = send({ ...chat, open });
    if (detail.found !== true) return false;
    void api('/api/task-results/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: chat.ids }) }).catch(() => null);
    return true;
  };
  // No pop-up inside the app: new results become a chat in the list. With the page out of sight and notices allowed,
  // one system notice says so, and a tap on it opens that chat.
  const notify = (fresh: readonly TaskResult[]) => {
    if (!fresh.length) return;
    const made = tell(fresh, false);
    if (!made || muted()) return;
    if (typeof root.Notification !== 'function' || root.Notification.permission !== 'granted') return;
    if (root.document?.visibilityState === 'visible') return;
    const last = fresh[fresh.length - 1];
    const title = fresh.length > 1 ? `Hafize: ${fresh.length} görev sonucu` : last.ok ? 'Hafize görevi tamamlandı' : 'Hafize görevi başarısız';
    try {
      const notice = new root.Notification(title, { body: taskTitle(last.task), tag: 'hafize-gorev-sonucu', icon: '/icons/icon-192.png' });
      notice.onclick = () => { root.focus(); send({ open: true }); notice.close(); };
    } catch { /* some platforms only allow notifications from a service worker */ }
  };
  /** A tap on a phone notice: the newest notice chat is opened; when there is none yet, the unread results make one. */
  const openFromNotice = async () => {
    if (send({ open: true }).opened === true && !results.some((result) => !result.readAt)) return;
    try {
      const response = await api('/api/task-results');
      if (response.ok) { const data = await response.json(); results = Array.isArray(data?.results) ? data.results : results; }
    } catch { /* what is already known is used */ }
    const unread = results.filter((result) => !result.readAt);
    if (unread.length) { tell([...unread].reverse(), true); writeSeen(new Set(results.map((result) => result.id))); renderList(); }
    else send({ open: true });
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
    renderToolbar();
    list.replaceChildren();
    if (!results.length) { list.append(el('li', 'settings-memory-empty', 'Henüz arka plan görevi çalışmadı.')); return; }
    const visible = showAll ? results : results.slice(0, SHOWN_AT_FIRST);
    for (const result of visible) {
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
    if (visible.length < results.length) {
      const more = el('li', 'settings-memory-empty');
      const button = el('button', '', `Kalan ${results.length - visible.length} sonucu göster`);
      button.type = 'button';
      button.addEventListener('click', () => { showAll = true; renderList(); });
      more.append(button);
      list.append(more);
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
    notify(fresh);
    // Only what is still listed is remembered, so the memory never outgrows the list.
    writeSeen(new Set(results.map((result) => result.id)));
    renderList();
  };

  const attachPanel = (host: Element) => {
    if (host.querySelector('.task-results')) return;
    panel = el('section', 'settings-panel task-results');
    panel.append(el('h2', '', 'Görev sonuçları'), el('p', '', 'Kuralların ve zamanlanmış görevlerin arka planda ürettiği yanıtlar burada toplanır.'));
    permissionRow = el('div', 'settings-actions');
    toolbar = el('div', 'settings-actions task-results-toolbar');
    list = el('ul', 'settings-memory-list task-result-list');
    panel.append(permissionRow, toolbar, list);
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
  // Opened by a tap on a notice: from the service worker when the app was already open, from the address when not.
  root.navigator?.serviceWorker?.addEventListener?.('message', (event: MessageEvent) => { if (event.data?.type === 'hafize:push-open') void openFromNotice(); });
  try {
    const url = new URL(root.location.href);
    if (url.searchParams.has('bildirim')) {
      url.searchParams.delete('bildirim');
      root.history?.replaceState?.(null, '', `${url.pathname}${url.search}${url.hash}`);
      void openFromNotice();
    }
  } catch { /* no address to read, as in a test */ }
  return () => { if (timer) clearInterval(timer); watcher?.disconnect(); panel?.remove(); };
}

const api = Object.freeze({ errorText, installTaskNotifications, newResults, noticeChat, taskTitle, MUTED_KEY });
(globalThis as typeof globalThis & { HafizeTaskNotifications?: unknown }).HafizeTaskNotifications = api;
if (typeof document !== 'undefined') {
  const start = () => installTaskNotifications(document, globalThis);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
