// TypeScript migration wave 2026-09.
// Behavior is preserved while the browser module moves behind the typed Vite boundary.
// @ts-nocheck
(function installScheduledTasksWorkspace(root) {
  'use strict';

  const API_PATH = '/api/schedules';
  const PANEL_ID = 'scheduledTasksWorkspace';
  const MAX_TASK = 20_000;
  const MAX_LIST = 128;
  const MAX_ATTEMPTS = 5;
  const REFRESH_MS = 30_000;
  let panel = null;
  let mounted = false;
  let refreshTimer = 0;
  let lastFocus = null;
  let selectedStatus = 'all';
  let controller = null;

  const doc = () => root.document;
  const make = (tag, text, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const button = (label, action, className = 'soft-btn') => {
    const node = make('button', label, className);
    node.type = 'button';
    if (action) node.dataset.taskAction = action;
    return node;
  };
  const clamp = (value, limit) => String(value ?? '').slice(0, limit);
  const statusText = (value) => ({ scheduled: 'Planlandı', running: 'Çalışıyor', completed: 'Tamamlandı', failed: 'Başarısız', cancelled: 'İptal edildi' })[value] || 'Bilinmiyor';
  const safeJson = async (response) => { try { return await response.json(); } catch { return null; } };

  async function request(path = API_PATH, options = {}) {
    controller?.abort?.();
    controller = typeof AbortController === 'function' ? new AbortController() : null;
    const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    const response = await root.fetch(path, { ...options, credentials: 'same-origin', headers, signal: controller?.signal });
    const payload = await safeJson(response);
    if (!response.ok) {
      const error = new Error(payload?.code || payload?.error || `HTTP_${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload || {};
  }

  function agentOptions() {
    const select = doc().getElementById('agentSelect');
    return select ? [...select.options].filter((option) => option.value).map((option) => ({ id: option.value, label: option.textContent?.trim() || option.value })) : [];
  }

  function localDateTimeValue(offsetMinutes = 5) {
    const date = new Date(Date.now() + offsetMinutes * 60_000);
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function isoFromLocal(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function formattedDate(value) {
    const timestamp = Date.parse(value || '');
    return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : 'Tarih bilinmiyor';
  }

  function status(message, tone = '') {
    const target = panel?.querySelector('.scheduled-tasks-status');
    if (!target) return;
    target.textContent = clamp(message, 220);
    target.dataset.tone = tone;
  }

  function build() {
    panel = make('section', undefined, 'scheduled-tasks-overlay');
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'scheduledTasksTitle');

    const shell = make('div', undefined, 'scheduled-tasks-shell');
    const head = make('div', undefined, 'scheduled-tasks-head');
    const title = make('strong', 'Zamanlanmış görevler', 'scheduled-tasks-title');
    title.id = 'scheduledTasksTitle';
    head.append(title, button('Yenile', 'refresh', 'mini-btn'), button('Kapat', 'close', 'mini-btn'));

    const create = make('form', undefined, 'scheduled-tasks-create');
    create.noValidate = true;
    const heading = make('div', 'Yeni görev planla', 'scheduled-tasks-section-title');
    const agentLabel = make('label', 'Ajan');
    const agent = doc().createElement('select');
    agent.id = 'scheduledTaskAgent';
    agent.required = true;
    agent.setAttribute('aria-label', 'Zamanlanmış görev ajanı');
    agentOptions().forEach((item) => { const option = make('option', item.label); option.value = item.id; agent.append(option); });
    if (!agent.options.length) { const option = make('option', 'Ajanlar yükleniyor'); option.value = ''; agent.append(option); agent.disabled = true; }
    agentLabel.append(agent);

    const taskLabel = make('label', 'Görev metni');
    const task = doc().createElement('textarea');
    task.rows = 5; task.maxLength = MAX_TASK; task.required = true; task.placeholder = 'Örn. Bugünkü önemli gelişmeleri özetle ve takip edilmesi gereken noktaları çıkar.'; task.setAttribute('aria-label', 'Zamanlanacak görev metni');
    taskLabel.append(task);

    const whenLabel = make('label', 'Çalıştırma zamanı');
    const when = doc().createElement('input');
    when.type = 'datetime-local'; when.required = true; when.value = localDateTimeValue(); when.min = localDateTimeValue(); whenLabel.append(when);

    const attemptsLabel = make('label', 'Maksimum deneme');
    const attempts = doc().createElement('select'); attempts.setAttribute('aria-label', 'Maksimum deneme sayısı');
    for (let i = 1; i <= MAX_ATTEMPTS; i += 1) { const option = make('option', i); option.value = String(i); attempts.append(option); }
    attemptsLabel.append(attempts);

    const grid = make('div', undefined, 'scheduled-tasks-form-grid'); grid.append(agentLabel, whenLabel, attemptsLabel);
    const submit = button('Görevi planla', 'create'); submit.classList.add('primary');
    create.append(heading, taskLabel, grid, submit);

    const listSection = make('section', undefined, 'scheduled-tasks-list-section');
    listSection.setAttribute('aria-label', 'Planlanmış görevler listesi');
    listSection.append(make('div', 'Planlanan görevler', 'scheduled-tasks-section-title'));
    const filter = make('div', undefined, 'scheduled-tasks-filter');
    const filterSelect = doc().createElement('select'); filterSelect.setAttribute('aria-label', 'Görev durumuna göre filtrele');
    [['all','Tümü'],['scheduled','Planlandı'],['running','Çalışıyor'],['completed','Tamamlandı'],['failed','Başarısız'],['cancelled','İptal edildi']].forEach(([value,label]) => { const option = make('option', label); option.value = value; filterSelect.append(option); });
    const filterInfo = make('span', '', 'scheduled-tasks-filter-info'); filter.append(filterSelect, filterInfo);
    const list = make('div', undefined, 'scheduled-tasks-list'); list.setAttribute('role','list');
    listSection.append(filter, list);
    const statusNode = make('div', '', 'scheduled-tasks-status'); statusNode.setAttribute('role','status'); statusNode.setAttribute('aria-live','polite');
    shell.append(head, create, statusNode, listSection); panel.append(shell); doc().body.append(panel);

    create.addEventListener('submit', async (event) => {
      event.preventDefault();
      const taskText = task.value.trim();
      const runAt = isoFromLocal(when.value);
      if (!agent.value) return status('Geçerli bir ajan seçmelisin.', 'error');
      if (!taskText) return status('Görev metni boş olamaz.', 'error');
      if (!runAt || Date.parse(runAt) <= Date.now()) return status('Çalıştırma zamanı gelecekte olmalı.', 'error');
      submit.disabled = true;
      try {
        await request(API_PATH, { method: 'POST', body: JSON.stringify({ agentId: agent.value, task: taskText, runAt, maxAttempts: Number(attempts.value) }) });
        task.value = ''; when.value = localDateTimeValue(); status('Görev planlandı.', 'success'); await refresh();
      } catch (error) {
        status(error.status === 401 ? 'Oturum açılması gerekiyor.' : error.message === 'SCHEDULE_CAPACITY_REACHED' ? 'Görev kapasitesi dolu.' : 'Görev planlanamadı.', 'error');
      } finally { submit.disabled = false; }
    });

    filterSelect.addEventListener('change', () => { selectedStatus = filterSelect.value; applyFilter(list, filterInfo); });
    panel.addEventListener('click', onClick);
    panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    panel.addEventListener('click', (event) => { if (event.target === panel) close(); });
  }

  function row(entry) {
    const item = make('article', undefined, 'scheduled-task-row');
    item.dataset.scheduleId = clamp(entry.scheduleId, 120); item.dataset.status = entry.status; item.dataset.runAt = clamp(entry.runAt, 40);
    item.setAttribute('role','listitem');
    const head = make('div', undefined, 'scheduled-task-row-head');
    const title = make('strong', clamp(entry.task, 120));
    const badge = make('span', statusText(entry.status), `scheduled-task-status status-${entry.status}`); head.append(title, badge);
    const meta = make('div', `${formattedDate(entry.runAt)} · ${clamp(entry.agentId, 80)} · deneme ${entry.attempts}/${entry.maxAttempts}`, 'scheduled-task-meta');
    const detail = make('p', entry.lastError ? `Son hata: ${clamp(entry.lastError, 120)}` : entry.status === 'completed' ? 'Başarıyla tamamlandı.' : '');
    const actions = make('div', undefined, 'scheduled-task-actions');
    if (entry.status === 'scheduled') actions.append(button('İptal et','cancel','mini-btn'));
    const trace = button('Trace ID','trace','mini-btn'); trace.title = clamp(entry.traceId, 128); trace.setAttribute('aria-label', `Trace ID: ${clamp(entry.traceId, 40)}`); actions.append(trace);
    item.append(head, meta, detail, actions);
    return item;
  }

  function applyFilter(list, info) {
    let visible = 0;
    [...list.children].forEach((node) => { if (!node.classList.contains('scheduled-task-row')) return; const show = selectedStatus === 'all' || node.dataset.status === selectedStatus; node.hidden = !show; if (show) visible += 1; });
    info.textContent = `${visible} görev gösteriliyor.`;
  }

  async function refresh() {
    const list = panel?.querySelector('.scheduled-tasks-list'); const info = panel?.querySelector('.scheduled-tasks-filter-info');
    if (!list) return;
    list.replaceChildren(make('div','Görevler yükleniyor…','scheduled-tasks-empty'));
    try {
      const payload = await request(API_PATH);
      const entries = Array.isArray(payload.schedules) ? payload.schedules.slice(0, MAX_LIST) : [];
      entries.sort((a,b) => String(a.runAt).localeCompare(String(b.runAt)) || String(a.scheduleId).localeCompare(String(b.scheduleId)));
      list.replaceChildren();
      if (!entries.length) list.append(make('div','Henüz planlanmış görev yok.','scheduled-tasks-empty'));
      else entries.forEach((entry) => list.append(row(entry)));
      applyFilter(list, info);
    } catch (error) {
      list.replaceChildren(make('div', error.status === 401 ? 'Görevleri görmek için oturum açmalısın.' : 'Görev listesi yüklenemedi.','scheduled-tasks-empty'));
      status(error.status === 401 ? 'Kimlik doğrulama gerekli.' : 'Görev servisine ulaşılamadı.','error');
    }
  }

  async function cancelTask(id) {
    if (!id || !root.confirm?.('Bu planlanmış görev iptal edilsin mi?')) return;
    try { await request(`${API_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' }); status('Görev iptal edildi.','success'); await refresh(); }
    catch (error) { status(error.message === 'SCHEDULE_NOT_CANCELLABLE' ? 'Görev artık iptal edilemez.' : 'Görev iptal edilemedi.','error'); await refresh(); }
  }

  function onClick(event) {
    const target = event.target?.closest?.('[data-task-action]'); if (!target) return;
    const action = target.dataset.taskAction;
    if (action === 'close') return close();
    if (action === 'refresh') return refresh();
    if (action === 'cancel') return cancelTask(target.closest('.scheduled-task-row')?.dataset.scheduleId);
    if (action === 'trace') return status(`Trace ID: ${target.title}`,'info');
  }

  function open() {
    if (!panel) return;
    lastFocus = doc().activeElement; panel.hidden = false; selectedStatus = 'all';
    const filter = panel.querySelector('.scheduled-tasks-filter select'); if (filter) filter.value = 'all';
    refresh(); clearInterval(refreshTimer); refreshTimer = root.setInterval?.(refresh, REFRESH_MS) || 0;
    panel.querySelector('[data-task-action="close"]')?.focus();
  }

  function close() { if (!panel) return; panel.hidden = true; clearInterval(refreshTimer); refreshTimer = 0; controller?.abort?.(); lastFocus?.focus?.(); lastFocus = null; }

  function boot() {
    if (mounted || !doc()) return;
    const nav = [...doc().querySelectorAll('.nav-item')].find((node) => node.textContent?.includes('Görevler'));
    if (!nav) return;
    build(); nav.disabled = false; nav.addEventListener('click', open); nav.setAttribute('aria-controls', PANEL_ID); nav.setAttribute('aria-expanded', 'false');
    mounted = true;
  }

  root.ScheduledTasksWorkspace = Object.freeze({ open, close, refresh, request });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
