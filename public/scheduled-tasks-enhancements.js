(function enhanceScheduledTasksWorkspace(root) {
  'use strict';

  const PANEL_ID = 'scheduledTasksWorkspace';
  const templates = Object.freeze([
    ['Günlük özet', 'Bugünkü önemli gelişmeleri özetle ve öncelikli maddeleri belirt.'],
    ['Satış özeti', 'Satış verilerini incele; önemli sapmaları ve takip edilmesi gereken noktaları çıkar.'],
    ['Kod incelemesi', 'Projede son değişiklikleri gözden geçir; riskleri, regresyonları ve iyileştirmeleri özetle.'],
    ['Araştırma özeti', 'Belirtilen konu için güvenilir kaynakları incele ve kısa bir karar notu hazırla.'],
    ['Haftalık plan', 'Önümüzdeki hafta için işleri önceliklendir ve uygulanabilir bir çalışma planı çıkar.'],
    ['Kontrol listesi', 'Verilen görev için tamamlanma kontrol listesi oluştur ve kritik adımları işaretle.']
  ]);

  const make = (tag, text, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  function status(message, tone = '') {
    const target = /** @type {HTMLElement | null} */ (root.document.querySelector(`#${PANEL_ID} .scheduled-tasks-status`));
    if (!target) return;
    target.textContent = String(message).slice(0, 220);
    target.dataset.tone = tone;
  }

  function addTemplates(panel) {
    if (panel.querySelector('.scheduled-tasks-template-section')) return;
    const create = panel.querySelector('.scheduled-tasks-create');
    if (!create) return;
    const section = make('div', undefined, 'scheduled-tasks-template-section');
    section.append(make('div', 'Hızlı şablonlar', 'scheduled-tasks-section-title'));
    const grid = make('div', undefined, 'scheduled-tasks-templates');
    templates.forEach(([title, task]) => {
      const button = make('button', undefined, 'scheduled-task-template');
      button.type = 'button';
      button.dataset.templateTask = task;
      button.append(make('strong', title), make('span', task));
      grid.append(button);
    });
    section.append(grid);
    create.insertBefore(section, create.querySelector('.scheduled-tasks-form-grid') || null);
  }

  function addFilter(panel) {
    const section = panel.querySelector('.scheduled-tasks-list-section');
    if (!section || section.querySelector('.scheduled-tasks-filter')) return;
    const wrap = make('div', undefined, 'scheduled-tasks-filter');
    const select = root.document.createElement('select');
    select.setAttribute('aria-label', 'Görevleri duruma göre filtrele');
    [['all','Tüm durumlar'],['scheduled','Planlandı'],['running','Çalışıyor'],['completed','Tamamlandı'],['failed','Başarısız'],['cancelled','İptal edildi']].forEach(([value, label]) => {
      const option = make('option', label); option.value = value; select.append(option);
    });
    const info = make('span', '', 'scheduled-tasks-filter-info');
    wrap.append(select, info);
    section.insertBefore(wrap, section.querySelector('.scheduled-tasks-list'));
    select.addEventListener('change', () => filterRows(panel, select.value, info));
  }

  function filterRows(panel, selected, info) {
    const rows = [...panel.querySelectorAll('.scheduled-task-row')];
    let visible = 0;
    rows.forEach((row) => {
      const show = selected === 'all' || row.dataset.status === selected;
      row.hidden = !show;
      if (show) visible += 1;
    });
    if (info) info.textContent = `${visible} görev gösteriliyor.`;
  }

  function onTemplate(event) {
    const target = /** @type {HTMLElement | null} */ (event.target?.closest?.('[data-template-task]') ?? null);
    if (!target) return;
    const textarea = /** @type {HTMLTextAreaElement | null} */ (root.document.querySelector(`#${PANEL_ID} .scheduled-tasks-create textarea`));
    if (!textarea) return;
    textarea.value = target.dataset.templateTask || '';
    textarea.focus();
    status('Şablon görev metnine aktarıldı.', 'info');
  }

  function enhance(panel) {
    addTemplates(panel);
    addFilter(panel);
    const select = panel.querySelector('.scheduled-tasks-filter select');
    const info = panel.querySelector('.scheduled-tasks-filter-info');
    if (select && info) filterRows(panel, select.value, info);
  }

  function boot() {
    if (!root.document) return;
    const observer = new MutationObserver(() => {
      const panel = root.document.getElementById(PANEL_ID);
      if (!panel || panel.dataset.enhanced === 'true') return;
      panel.dataset.enhanced = 'true';
      enhance(panel);
      panel.addEventListener('click', onTemplate);
    });
    observer.observe(root.document.documentElement, { childList: true, subtree: true });
    root.addEventListener('beforeunload', () => observer.disconnect(), { once: true });
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
