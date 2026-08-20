(function exposeHafizeScheduleCreate(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeScheduleCreate = api;
  api.mount(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleCreate() {
  'use strict';

  const PATH = '/api/schedules';
  const MAX_TASK_CHARS = 4000;
  const MAX_AGENT_ID_CHARS = 120;
  const MAX_ATTEMPTS = 5;
  const CREATED_EVENT = 'hafize:schedule-created';
  const ACTIVE_HEADS = new WeakSet();

  function cleanText(value, maxChars) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    return text && text.length <= maxChars ? text : null;
  }

  function normalizeAgentId(value, allowedIds = []) {
    const id = cleanText(value, MAX_AGENT_ID_CHARS);
    if (!id || !Array.isArray(allowedIds) || !allowedIds.includes(id)) return null;
    return id;
  }

  function normalizeTask(value) {
    return cleanText(value, MAX_TASK_CHARS);
  }

  function localDateTimeToIso(value) {
    const text = cleanText(value, 32);
    if (!text || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null;
    const date = new Date(text);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function normalizeAttempts(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 1 && number <= MAX_ATTEMPTS ? number : null;
  }

  function buildCreateInput({ agentId, task, runAtLocal, maxAttempts }, allowedAgentIds) {
    const normalizedAgentId = normalizeAgentId(agentId, allowedAgentIds);
    const normalizedTask = normalizeTask(task);
    const runAt = localDateTimeToIso(runAtLocal);
    const attempts = normalizeAttempts(maxAttempts);
    if (!normalizedAgentId || !normalizedTask || !runAt || attempts == null) return null;
    return Object.freeze({ agentId: normalizedAgentId, task: normalizedTask, runAt, maxAttempts: attempts });
  }

  async function readPayload(response) {
    try {
      const value = await response.json();
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function createClient({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_SCHEDULE_CREATE_FETCH');
    return Object.freeze({
      async create(input) {
        const response = await fetchImpl(PATH, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify(input)
        });
        return Object.freeze({
          ok: Boolean(response?.ok),
          status: Number(response?.status) || 0,
          payload: Object.freeze(await readPayload(response))
        });
      }
    });
  }

  function allowedAgentIds(select) {
    const ids = [];
    for (const option of Array.from(select?.options || [])) {
      const id = cleanText(option?.value, MAX_AGENT_ID_CHARS);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  function nextDefaultLocalDate(now = new Date()) {
    const date = new Date(now.getTime() + 60 * 60 * 1000);
    date.setSeconds(0, 0);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function createForm(documentRef) {
    const section = documentRef.createElement('section');
    section.className = 'schedule-create-panel';
    section.hidden = true;

    const form = documentRef.createElement('form');
    form.className = 'schedule-create-form';
    form.noValidate = true;

    const agentLabel = documentRef.createElement('label');
    agentLabel.textContent = 'Ajan';
    const agent = documentRef.createElement('select');
    agent.name = 'agentId';
    agent.required = true;
    agent.setAttribute('aria-label', 'Zamanlanmış görev ajanı');
    agentLabel.append(agent);

    const taskLabel = documentRef.createElement('label');
    taskLabel.textContent = 'Görev';
    const task = documentRef.createElement('textarea');
    task.name = 'task';
    task.required = true;
    task.maxLength = MAX_TASK_CHARS;
    task.rows = 4;
    task.placeholder = 'Hafize bu zamanda ne yapsın?';
    taskLabel.append(task);

    const runAtLabel = documentRef.createElement('label');
    runAtLabel.textContent = 'Çalışma zamanı';
    const runAt = documentRef.createElement('input');
    runAt.name = 'runAt';
    runAt.type = 'datetime-local';
    runAt.required = true;
    runAt.step = '60';
    runAtLabel.append(runAt);

    const attemptsLabel = documentRef.createElement('label');
    attemptsLabel.textContent = 'En fazla deneme';
    const attempts = documentRef.createElement('select');
    attempts.name = 'maxAttempts';
    for (let value = 1; value <= MAX_ATTEMPTS; value += 1) {
      attempts.append(new Option(String(value), String(value), value === 1, value === 1));
    }
    attemptsLabel.append(attempts);

    const note = documentRef.createElement('p');
    note.className = 'schedule-create-note';
    note.textContent = 'Görev yalnız bu düğmeye bastığında oluşturulur. Dış gönderme veya yazma işlemleri varsa ilgili araç ayrıca onay ister.';

    const status = documentRef.createElement('p');
    status.className = 'schedule-create-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;

    const actions = documentRef.createElement('div');
    actions.className = 'schedule-create-actions';
    const cancel = documentRef.createElement('button');
    cancel.type = 'button';
    cancel.className = 'mini-btn';
    cancel.textContent = 'Vazgeç';
    const submit = documentRef.createElement('button');
    submit.type = 'submit';
    submit.className = 'schedule-create-submit';
    submit.textContent = 'Görev oluştur';
    actions.append(cancel, submit);

    form.append(agentLabel, taskLabel, runAtLabel, attemptsLabel, note, status, actions);
    section.append(form);
    return { section, form, agent, task, runAt, attempts, note, status, cancel, submit };
  }

  function syncAgentOptions(target, source) {
    const current = target.value;
    target.replaceChildren();
    for (const option of Array.from(source?.options || [])) {
      const id = cleanText(option?.value, MAX_AGENT_ID_CHARS);
      if (!id) continue;
      target.append(new Option(option.textContent || id, id));
    }
    if (Array.from(target.options).some((option) => option.value === current)) target.value = current;
    else if (source?.value && Array.from(target.options).some((option) => option.value === source.value)) target.value = source.value;
  }

  function mount(documentRef, root, { fetchImpl = root?.fetch, now = () => new Date() } = {}) {
    if (!documentRef || !root) return null;
    const card = documentRef.querySelector?.('#scheduleListCard');
    const head = card?.querySelector?.('.schedule-list-head');
    const sourceAgent = documentRef.querySelector?.('#agentSelect');
    if (!card || !head || !sourceAgent || ACTIVE_HEADS.has(head) || documentRef.querySelector?.('.schedule-create-panel')) return null;

    let client;
    try { client = createClient({ fetchImpl }); } catch { return null; }

    ACTIVE_HEADS.add(head);
    let open = null;
    let nodes = null;
    try {
      open = documentRef.createElement('button');
      open.type = 'button';
      open.className = 'mini-btn schedule-create-open';
      open.textContent = '＋ Görev';
      open.setAttribute('aria-expanded', 'false');
      open.setAttribute('aria-label', 'Yeni zamanlanmış görev oluştur');
      head.append(open);

      nodes = createForm(documentRef);
      card.append(nodes.section);
    } catch {
      nodes?.section?.remove?.();
      open?.remove?.();
      ACTIVE_HEADS.delete(head);
      return null;
    }

    let busy = false;
    let destroyed = false;
    let openListenerInstalled = false;
    let cancelListenerInstalled = false;
    let submitListenerInstalled = false;
    let keyListenerInstalled = false;

    function setOpen(value) {
      const visible = Boolean(value);
      nodes.section.hidden = !visible;
      open.setAttribute('aria-expanded', String(visible));
      if (visible) {
        syncAgentOptions(nodes.agent, sourceAgent);
        nodes.runAt.value = nodes.runAt.value || nextDefaultLocalDate(now());
        nodes.task.focus?.();
      }
    }

    function setBusy(value) {
      busy = Boolean(value);
      nodes.form.setAttribute('aria-busy', String(busy));
      nodes.submit.disabled = busy;
      nodes.cancel.disabled = busy;
      open.disabled = busy;
    }

    function showStatus(text, state) {
      nodes.status.hidden = false;
      nodes.status.dataset.state = state;
      nodes.status.textContent = text;
    }

    function clearStatus() {
      nodes.status.hidden = true;
      nodes.status.textContent = '';
      delete nodes.status.dataset.state;
    }

    async function onSubmit(event) {
      event.preventDefault();
      if (busy || destroyed) return;
      clearStatus();
      const agents = allowedAgentIds(sourceAgent);
      const input = buildCreateInput({
        agentId: nodes.agent.value,
        task: nodes.task.value,
        runAtLocal: nodes.runAt.value,
        maxAttempts: nodes.attempts.value
      }, agents);
      if (!input) {
        showStatus('Ajan, görev, zaman ve deneme alanlarını kontrol et.', 'error');
        return;
      }
      if (Date.parse(input.runAt) <= now().getTime()) {
        showStatus('Çalışma zamanı gelecekte olmalı.', 'error');
        return;
      }

      setBusy(true);
      showStatus('Görev güvenli biçimde oluşturuluyor…', 'loading');
      try {
        const result = await client.create(input);
        if (destroyed) return;
        if (result.status === 401) {
          showStatus('Görev oluşturmak için güvenli cloud oturumu aç.', 'auth');
          return;
        }
        if (!result.ok || result.payload?.ok !== true) {
          const message = result.status === 400 ? 'Görev alanları sunucu tarafından reddedildi.'
            : result.status === 503 ? 'Zamanlanmış görev kapasitesi şu anda dolu.'
              : 'Görev oluşturulamadı.';
          showStatus(message, 'error');
          return;
        }
        nodes.form.reset();
        nodes.attempts.value = '1';
        nodes.runAt.value = nextDefaultLocalDate(now());
        showStatus('Görev oluşturuldu.', 'success');
        root.dispatchEvent?.(new root.CustomEvent(CREATED_EVENT));
      } catch {
        if (!destroyed) showStatus('Görev servisine ulaşılamadı.', 'error');
      } finally {
        if (!destroyed) setBusy(false);
      }
    }

    function onOpen() { setOpen(nodes.section.hidden); }
    function onCancel() { if (!busy) { clearStatus(); setOpen(false); open.focus?.(); } }
    function onKeydown(event) { if (event?.key === 'Escape' && !nodes.section.hidden && !busy) onCancel(); }

    function releaseInstallation() {
      if (openListenerInstalled) {
        open.removeEventListener?.('click', onOpen);
        openListenerInstalled = false;
      }
      if (cancelListenerInstalled) {
        nodes.cancel.removeEventListener?.('click', onCancel);
        cancelListenerInstalled = false;
      }
      if (submitListenerInstalled) {
        nodes.form.removeEventListener?.('submit', onSubmit);
        submitListenerInstalled = false;
      }
      if (keyListenerInstalled) {
        documentRef.removeEventListener?.('keydown', onKeydown);
        keyListenerInstalled = false;
      }
      nodes.section.remove?.();
      open.remove?.();
      ACTIVE_HEADS.delete(head);
    }

    try {
      open.addEventListener('click', onOpen);
      openListenerInstalled = true;
      nodes.cancel.addEventListener('click', onCancel);
      cancelListenerInstalled = true;
      nodes.form.addEventListener('submit', onSubmit);
      submitListenerInstalled = true;
      if (typeof documentRef.addEventListener === 'function') {
        documentRef.addEventListener('keydown', onKeydown);
        keyListenerInstalled = true;
      }
    } catch {
      destroyed = true;
      releaseInstallation();
      return null;
    }

    return Object.freeze({
      isOpen: () => !nodes.section.hidden,
      getState: () => Object.freeze({ busy }),
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        releaseInstallation();
        return true;
      }
    });
  }

  return Object.freeze({
    PATH, MAX_TASK_CHARS, MAX_AGENT_ID_CHARS, MAX_ATTEMPTS, CREATED_EVENT,
    normalizeAgentId, normalizeTask, localDateTimeToIso, normalizeAttempts,
    buildCreateInput, allowedAgentIds, nextDefaultLocalDate, createClient, mount
  });
});
