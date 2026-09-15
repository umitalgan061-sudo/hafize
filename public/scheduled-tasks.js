(function installScheduledTasksWorkspace(root) {
  'use strict';

  const API_PATH = '/api/schedules';
  const PANEL_ID = 'scheduledTasksWorkspace';
  const MAX_TASK = 20_000;
  const MAX_ITEMS = 128;
  const REFRESH_MS = 30_000;
  let mounted = false;
  let timer = 0;
  let panel = null;
  let lastFocus = null;

  const doc = () => root.document;
  const make = (tag, text, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (label, action, className = 'soft-btn') => {
    const node = make('button', label, className);
    node.type = 'button';
    if (action) node.dataset.taskAction = action;
    return node;
  };
  const statusLabel = (status) => ({ scheduled: 'Planlandı', running: 'Çalışıyor', completed: 'Tamamlandı', failed: 'Başarısız', cancelled: 'İptal edildi' })[status] || status;
  const clamp = (value, limit) => String(value ?? '').slice(0, limit);

  async function request(path = API_PATH, options = {}) {
    const response = await root.fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(payload?.code || payload?.error || `HTTP_${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function agentOptions() {
    const source = doc()?.getElementById?.('agentSelect');
    if (!source) return [];
    return [...source.options].filter((option) => option.value).map((option) => ({ id: option.value, label: option.textContent || option.value }));
  }

  function isoFromLocal(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }

  function formatDate(value) {
    const timestamp = Date.parse(value || '');
    if (!Number.isFinite(timestamp)) return 'Tarih bilinmiyor';
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
  }

  function setStatus(message, tone = '') {
    const node = panel?.querySelector?.('.scheduled-tasks-status');
    if (!node) return;
    node.textContent = clamp(message, 220);
    node.dataset.tone = tone;
  }

  function currentTimeValue() {
    const date = new Date(Date.now() + 60_000);
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function renderHeader() {
    const head = panel.querySelector('.scheduled-tasks-head');
    head.replaceChildren();
    const title = make('strong', 'Zamanlanmış görevler', 'scheduled-tasks-title');
    title.id = 'scheduledTasksTitle';
    const refresh = button('Yenile', 'refresh', 'mini-btn');
    const close = button('Kapat', 'close', 'mini-btn');
    head.append(title, refresh, close);
  }

  function renderCreateForm() {
    const create = panel.querySelector('.scheduled-tasks-create');
    create.replaceChildren();
    const title = make('div', 'Yeni görev planla', 'scheduled-tasks-section-title');
    const agentLabel = make('label', 'Ajan');
    const agent = doc().createElement('select');
    agent.setAttribute('aria-label', 'Zamanlanmış görev ajanı');
    agent.id = 'scheduledTaskAgent';
    const options = agentOptions();
    options.forEach((item) => { const option = make('option', item.label); option.value = item.id; agent.append(option); });
    if (!options.length) {
      const option = make('option', 'Ajanlar henüz yüklenmedi'); option.value = ''; agent.append(option); agent.disabled = true;
    }
    agentLabel.append(agent);

    const taskLabel = make('label', 'Görev metni');
    const task = doc().createElement('textarea');
    task.rows = 5; task.maxLength = MAX_TASK; task.placeholder = 'Örneğin: Bugünkü satış özetini hazırla ve önemli sapmaları maddeler halinde açıkla.';
    task.setAttribute('aria-label', 'Zamanlanacak görev metni');
    taskLabel.append(task);

    const whenLabel = make('label', 'Çalıştırma zamanı');
    const when = doc().createElement('input');
    when.type = 'datetime-local'; when.value = currentTimeValue(); when.min = currentTimeValue(); when.setAttribute('aria-label', 'Görevin çalıştırılacağı tarih ve saat');
    whenLabel.append(when);

    const attemptsLabel = make('label', 'Maksimum deneme');
    const attempts = doc().createElement('select');
    attempts.setAttribute('aria-label', 'Maksimum deneme sayısı');
    for (let index = 1; index <= 5; index += 1) { const option = make('option', String(index)); option.value = String(index); attempts.append(option); }
    attempts.value = '1'; attemptsLabel.append(attempts);

    const grid = make('div', undefined, 'scheduled-tasks-form-grid');
    const submit = button('Görevi planla', 'create'); submit.classList.add('primary');
    grid.append(agentLabel, whenLabel, attemptsLabel);
    create.append(title, taskLabel, grid, submit);

    submit.addEventListener('click', async () => {
      const taskText = task.value.trim();
      const runAt = isoFromLocal(when.value);
      if (!agent.value) return setStatus('Önce bir ajan yüklenmeli.', 'error');
      if (!taskText) return setStatus('Görev metni boş olamaz.', 'error');
      if (taskText.length > MAX_TASK) return setStatus('Görev metni 20.000 karakteri aşamaz.', 'error');
      if (!runAt || Date.parse(runAt) <= Date.now()) return setStatus('Çalıştırma zamanı gelecekte olmalı.', 'error');
      submit.disabled = true;
      try {
        await request(API_PATH, { method: 'POST', body: JSON.stringify({ agentId: agent.value, task: taskText, runAt, maxAttempts: Number(attempts.value) }) });
        task.value = '';
        when.value = currentTimeValue();
        setStatus('Görev planlandı.', 'success');
        await refreshList();
      } catch (error) {
        setStatus(error.status === 401 ? 'Oturum açılması gerekiyor.' : error.message === 'SCHEDULE_CAPACITY_REACHED' ? 'Görev kapasitesi dolu.' : 'Görev planlanamadı.', 'error');
      } finally { submit.disabled = false; }
    });
  }

  function renderListShell() {
    const section = panel.querySelector('.scheduled-tasks-list-section');
    section.replaceChildren(make('div', 'Planlanan görevler', 'scheduled-tasks-section-title'));
    const list = make('div', undefined, 'scheduled-tasks-list');
    list.setAttribute('role', 'list');
    section.append(list);
  }

  function taskRow(entry) {
    const row = make('article', undefined, 'scheduled-task-row');
    row.dataset.scheduleId = entry.scheduleId;
    row.setAttribute('role', 'listitem');
    const head = make('div', undefined, 'scheduled-task-row-head');
    const title = make('strong', clamp(entry.task, 110));
    const status = make('span', statusLabel(entry.status), `scheduled-task-status status-${entry.status}`);
    head.append(title, status);
    const meta = make('div', `${formatDate(entry.runAt)} · ${entry.agentId} · ${entry.attempts}/${entry.maxAttempts} deneme`, 'scheduled-task-meta');
    const detail = make('p', entry.lastError ? `Son hata: ${entry.lastError}` : '');
    const actions = make('div', undefined, 'scheduled-task-actions');
    if (entry.status === 'scheduled') actions.append(button('İptal et', 'cancel', 'mini-btn'));
    const trace = button(`İz: ${clamp(entry.traceId, 32)}`, 'trace', 'mini-btn'); trace.title = entry.traceId;
    actions.append(trace);
    row.append(head, meta, detail, actions);
    return row;
  }

  async function refreshList() {
    const list = panel?.querySelector?.('.scheduled-tasks-list');
    if (!list) return;
    list.replaceChildren(make('div', 'Görevler yükleniyor…', 'scheduled-tasks-empty'));
    try {
      const payload = await request(API_PATH);
      const entries = Array.isArray(payload?.schedules) ? payload.schedules.slice(0, MAX_ITEMS) : [];
      list.replaceChildren();
      if (!entries.length) { list.append(make('div', 'Henüz planlanmış görev yok.', 'scheduled-tasks-empty')); return; }
      entries.sort((a, b) => String(a.runAt).localeCompare(String(b.runAt)) || String(a.scheduleId).localeCompare(String(b.scheduleId)));
      entries.forEach((entry) => list.append(taskRow(entry)));
    } catch (error) {
      list.replaceChildren(make('div', error.status === 401 ? 'Görevler için oturum açmalısın.' : 'Görev listesi yüklenemedi.', 'scheduled-tasks-empty'));
      setStatus(error.status === 401 ? 'Kimlik doğrulama gerekli.' : 'Görev servisine ulaşılamadı.', 'error');
    }
  }

  async function cancelTask(id) {
    if (!id || !root.confirm?.('Bu planlanmış görev iptal edilsin mi?')) return;
    try {
      await request(`${API_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setStatus('Görev iptal edildi.', 'success');
      await refreshList();
    } catch (error) {
      setStatus(error.message === 'SCHEDULE_NOT_CANCELLABLE' ? 'Bu görev artık iptal edilemez.' : 'Görev iptal edilemedi.', 'error');
      await refreshList();
    }
  }

  function onClick(event) {
    const target = event.target?.closest?.('[data-task-action]');
    if (!target || !panel) return;
    const action = target.dataset.taskAction;
    if (action === 'close') return close();
    if (action === 'refresh') return refreshList();
    if (action === 'cancel') return cancelTask(target.closest('.scheduled-task-row')?.dataset.scheduleId);
    if (action === 'trace') return setStatus(`Trace ID: ${target.title}`, 'info');
  }

  function open() {
    if (!panel) return;
    lastFocus = doc().activeElement;
    panel.hidden = false;
    renderHeader();
    renderCreateForm();
    renderListShell();
    setStatus('Görevler yükleniyor…');
    refreshList();
    panel.querySelector('.scheduled-tasks-head button[data-task-action="close"]')?.focus();
    clearInterval(timer);
    timer = root.setInterval?.(refreshList, REFRESH_MS) || 0;
  }

  function close() {
    if (!panel) return;
    panel.hidden = true;
    clearInterval(timer); timer = 0;
    lastFocus?.focus?.(); lastFocus = null;
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
    const create = make('div', undefined, 'scheduled-tasks-create');
    const list = make('div', undefined, 'scheduled-tasks-list-section');
    const status = make('div', '', 'scheduled-tasks-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    shell.append(head, create, status, list);
    panel.append(shell);
    doc().body.append(panel);
    panel.addEventListener('click', onClick);
    panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    panel.addEventListener('click', (event) => { if (event.target === panel) close(); });
  }

  function boot() {
    if (mounted || !doc()) return;
    const nav = [...doc().querySelectorAll('.nav-item')].find((node) => node.textContent?.includes('Görevler'));
    if (!nav) return;
    nav.disabled = false;
    nav.dataset.scheduledTasksTrigger = 'true';
    build();
    nav.addEventListener('click', open);
    mounted = true;
  }

  root.ScheduledTasksWorkspace = Object.freeze({ open, close, refresh: refreshList, request });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
