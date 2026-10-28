// Browser side of the agent platform: the inline approval dialog (risky actions wait for the user on
// the open stream), undo chips for reversible actions, live progress labels for long tools, the
// memory cache sync with the server and thumbs feedback per prompt variant. All network calls go
// through hafizeApi.
import { hafizeApi } from './hafize-api.ts';

type Json = Record<string, any>;
interface AgentEventContext {
  readonly assistantId: string;
  readonly showToast: (text: string) => void;
}

const MEMORY_KEY = 'hafize.memory.v1';
const runMeta = new Map<string, { traceId: string; variant: string }>();

function articleFor(messageId: string): HTMLElement | null {
  return document.querySelector(`#messages [data-message-id="${CSS.escape(messageId)}"]`);
}

// --- approval dialog -------------------------------------------------------------------
let openDialog: { id: string; close: () => void } | null = null;
const queue: Json[] = [];

const RISK_LABEL: Record<string, string> = { low: 'Düşük risk', medium: 'Orta risk', high: 'Yüksek risk' };
const MODE_LABEL: Record<string, string> = { once: 'Yalnızca bu sefer', session: 'Bu oturum boyunca', always: 'Her zaman' };

function showApproval(request: Json, ctx: AgentEventContext): void {
  if (openDialog) { queue.push(request); return; }
  const id = String(request.id || '');
  if (!id) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'approval-backdrop';
  const dialog = document.createElement('div');
  dialog.className = `approval-dialog risk-${['low', 'medium', 'high'].includes(request.risk) ? request.risk : 'high'}`;
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'approvalTitle');
  dialog.setAttribute('aria-describedby', 'approvalDetail');

  const badge = document.createElement('span');
  badge.className = 'approval-risk';
  badge.textContent = RISK_LABEL[request.risk] || RISK_LABEL.high;
  const title = document.createElement('h2');
  title.id = 'approvalTitle';
  title.textContent = String(request.title || 'Onay gerekiyor');
  const detail = document.createElement('pre');
  detail.id = 'approvalDetail';
  detail.className = 'approval-detail';
  detail.textContent = String(request.detail || '');
  const timer = document.createElement('p');
  timer.className = 'approval-timer';

  const modes = (Array.isArray(request.modes) ? request.modes : ['once']).filter((mode: string) => mode in MODE_LABEL);
  let mode = 'once';
  const modeGroup = document.createElement('div');
  modeGroup.className = 'approval-modes';
  if (modes.length > 1) {
    for (const value of modes) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `approvalMode-${id}`;
      input.value = value;
      input.checked = value === 'once';
      input.addEventListener('change', () => { mode = value; });
      label.append(input, ` ${MODE_LABEL[value]}`);
      modeGroup.append(label);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'approval-actions';
  const deny = document.createElement('button');
  deny.type = 'button';
  deny.className = 'soft-btn approval-deny';
  deny.textContent = 'Reddet';
  const never = document.createElement('button');
  never.type = 'button';
  never.className = 'soft-btn approval-never';
  never.textContent = 'Asla izin verme';
  const approve = document.createElement('button');
  approve.type = 'button';
  approve.className = 'primary-btn approval-approve';
  approve.textContent = 'Onayla';
  actions.append(deny, ...(Array.isArray(request.modes) && request.modes.includes('never') ? [never] : []), approve);

  dialog.append(badge, title, detail, modeGroup, timer, actions);
  backdrop.append(dialog);
  document.body.append(backdrop);
  const previousFocus = document.activeElement as HTMLElement | null;
  approve.focus();

  const expiresAt = Number(request.expiresAt) || Date.now() + 120_000;
  const tick = () => {
    const seconds = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
    timer.textContent = `Yanıt vermezsen ${seconds} saniye sonra reddedilir.`;
  };
  tick();
  const interval = window.setInterval(tick, 1000);

  const close = () => {
    window.clearInterval(interval);
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    if (openDialog?.id === id) openDialog = null;
    previousFocus?.focus?.();
    const next = queue.shift();
    if (next) showApproval(next, ctx);
  };
  const answer = (approved: boolean, chosenMode: string) => {
    close();
    hafizeApi.resolveApproval(id, approved, chosenMode).catch(() => ctx.showToast('Onay yanıtı iletilemedi; işlem süre dolunca reddedilecek.'));
    ctx.showToast(approved ? 'Onaylandı, devam ediliyor.' : 'Reddedildi.');
  };
  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); answer(false, 'once'); }
    if (event.key === 'Tab') {
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, input')];
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1]?.focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); }
    }
  }
  document.addEventListener('keydown', onKey, true);
  approve.addEventListener('click', () => answer(true, mode));
  deny.addEventListener('click', () => answer(false, 'once'));
  never.addEventListener('click', () => answer(false, 'never'));
  openDialog = { id, close };
}

// --- undo chips -----------------------------------------------------------------------
function addUndoChip(messageId: string, action: Json, ctx: AgentEventContext): void {
  const article = articleFor(messageId);
  if (!article || typeof action.id !== 'string') return;
  let bar = article.querySelector<HTMLElement>('.agent-undo-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'agent-undo-bar';
    article.querySelector('.content')?.after(bar);
    if (!bar.isConnected) article.append(bar);
  }
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'agent-undo-chip';
  chip.textContent = `↩ Geri al: ${String(action.summary || 'işlem').slice(0, 70)}`;
  chip.title = String(action.summary || '');
  chip.addEventListener('click', async () => {
    chip.disabled = true;
    try {
      await hafizeApi.undoAction(action.id);
      chip.textContent = `Geri alındı: ${String(action.summary || 'işlem').slice(0, 60)}`;
      chip.classList.add('done');
      ctx.showToast('İşlem geri alındı.');
      if (String(action.tool || '').startsWith('memory')) void refreshMemoryCache();
    } catch {
      chip.disabled = false;
      ctx.showToast('İşlem geri alınamadı.');
    }
  }, { once: false });
  bar.append(chip);
}

// --- live progress for long tools ------------------------------------------------------
function updateProgress(messageId: string, progress: Json): void {
  const container = articleFor(messageId)?.querySelector('.tool-activities');
  if (!container || typeof progress.label !== 'string') return;
  const badges = [...container.querySelectorAll<HTMLElement>('.tool-activity')].filter((badge) => !badge.classList.contains('failed'));
  const badge = badges[badges.length - 1];
  if (!badge) return;
  if (!badge.dataset.baseLabel) badge.dataset.baseLabel = badge.textContent || '';
  badge.textContent = `${badge.dataset.baseLabel} — ${progress.label}`;
}

// --- memory cache ---------------------------------------------------------------------
function readCache(): Array<{ id: string; text: string; createdAt?: string }> {
  try {
    const value = JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]');
    return Array.isArray(value) ? value.filter((note) => note && typeof note.id === 'string' && typeof note.text === 'string') : [];
  } catch { return []; }
}

/** The server is the source of truth; the browser keeps a copy for the settings list. */
function replaceMemoryCache(notes: ReadonlyArray<{ id: string; text: string }>): void {
  const previous = new Map(readCache().map((note) => [note.id, note]));
  const next = notes.slice(0, 200).map((note) => ({ id: note.id, text: String(note.text).slice(0, 300), createdAt: previous.get(note.id)?.createdAt || new Date().toISOString() }));
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new CustomEvent('hafize:memory-changed'));
}

async function refreshMemoryCache(): Promise<void> {
  try {
    const result = await hafizeApi.memoryList('semantic');
    if (Array.isArray(result.records)) replaceMemoryCache(result.records.map((record) => ({ id: String(record.id), text: String(record.content) })));
  } catch { /* offline or signed out: keep the cache */ }
}

window.addEventListener('hafize:memory-remote', (event) => {
  const detail = (event as CustomEvent).detail || {};
  const toast = (text: string) => {
    const element = document.querySelector('#toast');
    if (!element) return;
    element.textContent = text;
    element.classList.remove('hidden');
    window.setTimeout(() => element.classList.add('hidden'), 2600);
  };
  if (detail.action === 'delete' && typeof detail.id === 'string') hafizeApi.memoryDelete(detail.id).catch(() => toast('Not sunucudan silinemedi.'));
  if (detail.action === 'add' && typeof detail.id === 'string') hafizeApi.memoryAdd(String(detail.text || ''), 'semantic', detail.id).catch(() => toast('Not sunucuya kaydedilemedi.'));
  if (detail.action === 'purge') hafizeApi.memoryPurge().catch(() => toast('Hafıza sunucuda temizlenemedi.'));
  if (detail.action === 'export') {
    hafizeApi.memoryExport().then((text) => {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/x-ndjson' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `hafize-hafiza-${new Date().toISOString().slice(0, 10)}.jsonl`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }).catch(() => toast('Hafıza dışa aktarılamadı.'));
  }
});

// --- feedback --------------------------------------------------------------------------
document.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement | null)?.closest?.('.message-feedback-up, .message-feedback-down');
  const article = button?.closest<HTMLElement>('.message[data-message-id]');
  if (!button || !article) return;
  // message-workspace toggles aria-pressed in its own click handler; read the result afterwards.
  window.setTimeout(() => {
    const up = article.querySelector('.message-feedback-up')?.getAttribute('aria-pressed') === 'true';
    const down = article.querySelector('.message-feedback-down')?.getAttribute('aria-pressed') === 'true';
    const messageId = article.dataset.messageId || '';
    const meta = runMeta.get(messageId) || { traceId: article.dataset.traceId || '', variant: article.dataset.promptVariant || '' };
    hafizeApi.sendFeedback({ messageId, rating: up ? 'up' : down ? 'down' : '', traceId: meta.traceId, variant: meta.variant }).catch(() => {});
  }, 0);
}, true);

/** Handles the platform's stream events; returns true when the event was one of them. */
export function handleAgentEvent(type: string, payload: unknown, ctx: AgentEventContext): boolean {
  const data = (payload && typeof payload === 'object' ? payload : {}) as Json;
  switch (type) {
    case 'hafize-approval-required':
      showApproval(data, ctx);
      return true;
    case 'hafize-approval-resolved':
      if (openDialog?.id === data.id && data.reason !== 'user') {
        openDialog.close();
        ctx.showToast(data.reason === 'timeout' ? 'Onay süresi doldu; işlem yapılmadı.' : 'Onay isteği iptal edildi.');
      }
      return true;
    case 'hafize-action':
      addUndoChip(ctx.assistantId, data, ctx);
      return true;
    case 'hafize-tool-progress':
      updateProgress(ctx.assistantId, data);
      return true;
    case 'hafize-memory-sync':
      if (Array.isArray(data.notes)) replaceMemoryCache(data.notes.filter((note: Json) => typeof note?.id === 'string' && typeof note?.text === 'string'));
      return true;
    case 'hafize-run-meta': {
      const meta = { traceId: String(data.traceId || ''), variant: String(data.variant || '') };
      runMeta.set(ctx.assistantId, meta);
      const article = articleFor(ctx.assistantId);
      if (article) { article.dataset.traceId = meta.traceId; article.dataset.promptVariant = meta.variant; }
      return true;
    }
    case 'hafize-orchestrator':
      return true;
    default:
      return false;
  }
}
