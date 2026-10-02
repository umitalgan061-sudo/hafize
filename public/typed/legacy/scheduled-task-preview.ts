// @ts-nocheck
(function installScheduledTaskPreview(root) {
  'use strict';

  const PANEL_ID = 'scheduledTaskPreviewDialog';
  const WORKSPACE_ID = 'scheduledTasksWorkspace';
  const FORM_SELECTOR = '.scheduled-tasks-create';
  const BYPASS_FLAG = 'data-preview-submit-bypass';
  const MAX_TASK = 20000;
  const MAX_TEXT = 240;
  let mountedForm = null;
  let observer = null;
  let dialog = null;
  let lastSubmit = null;
  let previousFocus = null;
  let destroyed = false;
  let countdownTimer = 0;
  const cleanups = [];

  const doc = function () { return root.document; };
  const clip = function (value, limit) { return String(value == null ? '' : value).trim().slice(0, limit || MAX_TEXT); };
  const make = function (tag, value, className) {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  };
  const button = function (label, action, className) {
    const node = make('button', label, className || 'soft-btn');
    node.type = 'button';
    if (action) node.dataset.previewAction = action;
    return node;
  };

  function formatRunAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Geçersiz tarih';
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'full', timeStyle: 'short' }).format(date);
  }

  function selectedLabel(select) {
    return select && select.selectedOptions && select.selectedOptions[0]
      ? select.selectedOptions[0].textContent.trim() || select.value
      : (select && select.value) || 'Belirtilmedi';
  }

  function collect(form) {
    const agent = form.querySelector('#scheduledTaskAgent');
    const task = form.querySelector('textarea');
    const when = form.querySelector('input[type="datetime-local"]');
    const attempts = form.querySelector('select[aria-label="Maksimum deneme sayısı"]');
    return {
      agentId: clip(agent && agent.value, 120),
      agentLabel: clip(selectedLabel(agent), 120),
      task: clip(task && task.value, MAX_TASK),
      localWhen: clip(when && when.value, 40),
      attempts: Math.max(1, Math.min(5, Number(attempts && attempts.value) || 1))
    };
  }

  function validate(data) {
    const errors = [];
    if (!data.agentId) errors.push('Geçerli bir ajan seçmelisin.');
    if (!data.task) errors.push('Görev metni boş olamaz.');
    if (!data.localWhen) errors.push('Çalıştırma zamanı seçilmelidir.');
    const timestamp = Date.parse(data.localWhen);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) errors.push('Çalıştırma zamanı gelecekte olmalı.');
    if (data.task.length > MAX_TASK) errors.push('Görev metni sınırı aşıldı.');
    return errors;
  }

  function payloadFor(data) {
    return { agentId: data.agentId, task: data.task, runAt: new Date(data.localWhen).toISOString(), maxAttempts: data.attempts };
  }

  function countdownText(value) {
    const target = Date.parse(value || '');
    if (!Number.isFinite(target)) return 'Zaman hesaplanamadı';
    const left = Math.max(0, target - Date.now());
    const total = Math.floor(left / 1000);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (days) return 'T-' + days + ' gün ' + hours + ' saat';
    if (hours) return 'T-' + hours + ' saat ' + minutes + ' dk';
    if (minutes) return 'T-' + minutes + ' dk ' + seconds + ' sn';
    return 'T-' + seconds + ' sn';
  }

  function updateCountdown(value) {
    const node = dialog && dialog.querySelector('.scheduled-task-preview-countdown');
    if (node) node.textContent = countdownText(value);
  }

  function startCountdown(value) {
    clearInterval(countdownTimer);
    updateCountdown(value);
    countdownTimer = root.setInterval ? root.setInterval(function () { updateCountdown(value); }, 1000) : 0;
  }

  function stopCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = 0;
  }

  function activity(label) { try { root.dispatchEvent?.(new root.CustomEvent('hafize:scheduled-preview-activity', { detail: { label: String(label).slice(0, 120) } })); } catch {} }

  function report(message, tone) {
    const status = dialog && dialog.querySelector('.scheduled-task-preview-status');
    if (!status) return;
    status.textContent = clip(message, 220);
    status.dataset.tone = tone || '';
  }

  function trapFocus(event) {
    const shell = dialog && dialog.querySelector('[role="dialog"]');
    if (!shell) return;
    const focusables = Array.from(shell.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])'))
      .filter(function (node) { return !node.disabled && !node.hidden; });
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (event.shiftKey && doc().activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc().activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closePreview() {
    if (!dialog) return;
    dialog.hidden = true;
    stopCountdown();
    activity('Önizleme kapatıldı.');
    const focusTarget = previousFocus;
    previousFocus = null;
    lastSubmit = null;
    focusTarget && focusTarget.focus && focusTarget.focus();
  }

  function confirmPreview() {
    if (!lastSubmit) return;
    const form = lastSubmit.form;
    const data = collect(form);
    const errors = validate(data);
    if (errors.length) {
      render(data);
      report(errors[0], 'error');
      return;
    }
    form.setAttribute(BYPASS_FLAG, 'true');
    activity('Planlama onaylandı.');
    const originalFocus = doc().activeElement;
    closePreview();
    try {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    } catch {
      form.removeAttribute(BYPASS_FLAG);
      previousFocus = originalFocus;
      ensureDialog();
      dialog.hidden = false;
      report('Görev gönderimi başlatılamadı.', 'error');
      dialog.querySelector('[data-preview-action="confirm"]') && dialog.querySelector('[data-preview-action="confirm"]').focus();
    }
  }

  function render(data) {
    const values = {
      task: data.task || '—',
      agent: data.agentLabel || data.agentId || '—',
      when: formatRunAt(data.localWhen),
      attempts: String(data.attempts)
    };
    Object.keys(values).forEach(function (key) {
      const node = dialog && dialog.querySelector('[data-preview-field="' + key + '"]');
      if (node) node.textContent = values[key];
    });
    const payloadNode = dialog && dialog.querySelector('.scheduled-task-preview-payload');
    if (payloadNode) payloadNode.textContent = JSON.stringify(payloadFor(data), null, 2);
    const errors = validate(data);
    const confirm = dialog && dialog.querySelector('[data-preview-action="confirm"]');
    if (confirm) confirm.disabled = errors.length > 0;
  }

  function ensureDialog() {
    if (dialog || !doc() || !doc().body) return dialog;
    dialog = make('div', undefined, 'scheduled-task-preview-overlay');
    dialog.id = PANEL_ID;
    dialog.hidden = true;

    const shell = make('section');
    shell.className = 'scheduled-task-preview-shell';
    shell.setAttribute('role', 'dialog');
    shell.setAttribute('aria-modal', 'true');
    shell.setAttribute('aria-labelledby', 'scheduledTaskPreviewTitle');
    shell.setAttribute('aria-describedby', 'scheduledTaskPreviewDescription');

    const head = make('div', undefined, 'scheduled-task-preview-head');
    const title = make('h2', 'Görev planlama önizlemesi', 'scheduled-task-preview-title');
    title.id = 'scheduledTaskPreviewTitle';
    head.append(title, button('Kapat', 'close', 'mini-btn'));

    const description = make('p', 'Bu özet onaylanana kadar sunucuya görev gönderilmez.', 'scheduled-task-preview-description');
    description.id = 'scheduledTaskPreviewDescription';

    const summary = make('div', undefined, 'scheduled-task-preview-summary');
    const taskBox = make('div', undefined, 'scheduled-task-preview-task');
    taskBox.append(make('strong', 'Görev metni'));
    taskBox.append(make('p', '', 'scheduled-task-preview-task-value'));
    const meta = make('dl', undefined, 'scheduled-task-preview-meta');
    [['Ajan', 'agent'], ['Çalıştırma', 'when'], ['Maksimum deneme', 'attempts']].forEach(function (entry) {
      meta.append(make('dt', entry[0]), make('dd', '', 'scheduled-task-preview-' + entry[1]));
    });
    const countdown = make('div', '', 'scheduled-task-preview-countdown');
    countdown.setAttribute('aria-live', 'polite');
    const timezone = make('div', '', 'scheduled-task-preview-timezone');
    timezone.setAttribute('aria-live', 'polite');
    timezone.textContent = 'Zaman dilimi: ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || 'yerel');
    const payload = make('pre', '', 'scheduled-task-preview-payload');
    payload.hidden = true;
    const payloadToggle = button('İstek ayrıntılarını göster', 'toggle-payload', 'mini-btn');
    const copyPayload = button('Güvenli özeti kopyala', 'copy', 'mini-btn');
    summary.append(taskBox, meta, countdown, timezone, payloadToggle, payload, copyPayload);

    const status = make('div', '', 'scheduled-task-preview-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const actions = make('div', undefined, 'scheduled-task-preview-actions');
    actions.append(button('Düzenle', 'back', 'mini-btn'), button('Onayla ve planla', 'confirm', 'soft-btn'));
    actions.lastElementChild.classList.add('primary');

    shell.append(head, description, summary, status, actions);
    dialog.append(shell);
    doc().body.append(dialog);

    dialog.addEventListener('click', async function (event) {
      const target = event.target && event.target.closest ? event.target.closest('[data-preview-action]') : null;
      const action = target && target.dataset.previewAction;
      if (action === 'close' || action === 'back') { activity(action === 'back' ? 'Düzenlemeye dönüldü.' : 'Önizleme kapatıldı.'); closePreview(); }
      else if (action === 'confirm') confirmPreview();
      else if (action === 'toggle-payload') {
        const payloadNode = dialog.querySelector('.scheduled-task-preview-payload');
        const toggleNode = dialog.querySelector('[data-preview-action="toggle-payload"]');
        if (payloadNode) payloadNode.hidden = !payloadNode.hidden;
        if (toggleNode) toggleNode.textContent = payloadNode?.hidden ? 'İstek ayrıntılarını göster' : 'İstek ayrıntılarını gizle';
      } else if (action === 'copy') {
        const payloadNode = dialog.querySelector('.scheduled-task-preview-payload');
        try {
          await root.navigator?.clipboard?.writeText?.(payloadNode?.textContent || '');
          report('Güvenli görev özeti panoya kopyalandı.', 'info');
        } catch {
          report('Özet panoya kopyalanamadı.', 'error');
        }
      } else if (event.target === dialog) closePreview();
    });

    dialog.addEventListener('keydown', function (event) {
      if (dialog.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreview();
        return;
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        confirmPreview();
        return;
      }
      if (event.key === 'Tab') trapFocus(event);
    });

    cleanups.push(function () { dialog.remove(); });
    return dialog;
  }

  function openPreview(form) {
    const data = collect(form);
    lastSubmit = { form: form, data: data };
    previousFocus = doc().activeElement;
    ensureDialog();
    render(data);
    dialog.hidden = false;
    startCountdown(data.localWhen);
    activity('Önizleme açıldı.');
    const errors = validate(data);
    report(errors.length ? errors[0] : 'Onaydan önce görev özetini kontrol et.', errors.length ? 'error' : 'info');
    const confirm = dialog.querySelector('[data-preview-action="confirm"]');
    const back = dialog.querySelector('[data-preview-action="back"]');
    if (errors.length) (back || confirm).focus();
    else confirm.focus();
  }

  function intercept(event) {
    const form = event.currentTarget;
    if (form.getAttribute(BYPASS_FLAG) === 'true') {
      form.removeAttribute(BYPASS_FLAG);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    openPreview(form);
  }

  function attach(form) {
    if (!form || mountedForm === form || destroyed) return;
    mountedForm = form;
    form.addEventListener('submit', intercept, true);
    cleanups.push(function () { form.removeEventListener('submit', intercept, true); });
  }

  function scan() {
    if (destroyed) return;
    const form = doc() && doc().querySelector('#' + WORKSPACE_ID + ' ' + FORM_SELECTOR);
    if (form) attach(form);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    observer && observer.disconnect();
    observer = null;
    stopCountdown();
    closePreview();
    cleanups.splice(0).forEach(function (cleanup) { cleanup(); });
    mountedForm = null;
    dialog = null;
  }

  function boot() {
    if (!doc() || destroyed) return;
    scan();
    observer = typeof MutationObserver === 'function' ? new MutationObserver(scan) : null;
    observer && observer.observe(doc().documentElement, { childList: true, subtree: true });
    root.addEventListener && root.addEventListener('beforeunload', destroy, { once: true });
  }

  const api = Object.freeze({
    mount: boot,
    open: function () { if (mountedForm) openPreview(mountedForm); },
    close: closePreview,
    validate: validate,
    collect: collect,
    destroy: destroy
  });
  root.ScheduledTaskPreview = api;

  if (doc() && doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
