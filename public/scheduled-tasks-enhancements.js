(function enhanceScheduledTasksWorkspace(root) {
  'use strict';

  const PANEL_ID = 'scheduledTasksWorkspace';
  const MAX_TEMPLATES = 6;
  const templates = Object.freeze([
    ['Günlük özet', 'Bugünkü önemli gelişmeleri özetle ve öncelikli maddeleri belirt.'],
    ['Satış özeti', 'Satış verilerini incele; önemli sapmaları ve takip edilmesi gereken noktaları çıkar.'],
    ['Kod incelemesi', 'Projede son değişiklikleri gözden geçir; riskleri, regresyonları ve iyileştirmeleri özetle.'],
    ['Araştırma özeti', 'Belirtilen konu için güvenilir kaynakları incele ve kısa bir karar notu hazırla.'],
    ['Haftalık plan', 'Önümüzdeki hafta için işleri önceliklendir ve uygulanabilir bir çalışma planı çıkar.'],
    ['Kontrol listesi', 'Verilen görev için tamamlanma kontrol listesi oluştur ve kritik adımları işaretle.']
  ].slice(0, MAX_TEMPLATES));

  const make = (tag, text, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text, action, className = 'scheduled-task-template') => {
    const node = make('button', text, className);
    node.type = 'button';
    if (action) node.dataset.taskEnhancement = action;
    return node;
  };

  function report(message) {
    const node = root.document.querySelector(`#${PANEL_ID} .scheduled-tasks-status`);
    if (node) node.textContent = String(message).slice(0, 220);
  }

  function templateSection(panel) {
    if (panel.querySelector('.scheduled-tasks-templates')) return;
    const create = panel.querySelector('.scheduled-tasks-create');
    const heading = create?.querySelector('.scheduled-tasks-section-title');
    if (!create || !heading) return;
    const section = make('div', undefined, 'scheduled-tasks-template-section');
    section.append(make('div', 'Hızlı şablonlar', 'scheduled-tasks-section-title'));
    const grid = make('div', undefined, 'scheduled-tasks-templates');
    templates.forEach(([title, task]) => {
      const item = button(undefined, 'template');
      item.append(make('strong', title), make('span', task));
      item.dataset.templateTask = task;
      grid.append(item);
    });
    section.append(grid);
    create.insertBefore(section, create.querySelector('.scheduled-tasks-form-grid') || null);
  }

  function filterSection(panel) {
    const section = panel.querySelector('.scheduled-tasks-list-section');
    if (!section || section.querySelector('.scheduled-tasks-filter')) return;
    const filter = make('div', undefined, 'scheduled-tasks-filter');
    const select = root.document.createElement('select');
    select.setAttribute('aria-label', 'Görevleri duruma göre filtrele');
    [['all', 'Tüm durumlar'], ['scheduled', 'Planlandı'], ['running', 'Çalışıyor'], ['completed', 'Tamamlandı'], ['failed', 'Başarısız'], ['cancelled', 'İptal edildi']].forEach(([value, label]) => {
      const option = make('option', label); option.value = value; select.append(option);
    });
    const info = make('span', '', 'scheduled-tasks-filter-info');
    filter.append(select, info);
    section.insertBefore(filter, section.querySelector('.scheduled-tasks-list'));
    select.addEventListener('change', () => applyFilter(panel, select.value, info));
  }

  function applyFilter(panel, status, info) {
    const rows = [...panel.querySelectorAll('.scheduled-task-row')];
    let visible = 0;
    rows.forEach((row) => {
      const badge = row.querySelector('.scheduled-task-status');
      const matches = status === 'all' || (badge?.className || '').includes(`status-${status}`);
      row.hidden = !matches;
      if (matches) visible += 1;
    });
    if (info) info.textContent = `${visible} görev gösteriliyor.`;
  }

  function handleClick(event) {
    const target = event.target?.closest?.('[data-task-enhancement]');
    if (!target) return;
    if (target.dataset.taskEnhancement === 'template') {
      const task = target.dataset.templateTask || '';
      const textarea = root.document.querySelector(`#${PANEL_ID} .scheduled-tasks-create textarea`);
      if (textarea) {
        textarea.value = task;
        textarea.focus();
        report('Şablon görev metnine aktarıldı.');
      }
    }
  }

  function observePanel(panel) {
    templateSection(panel);
    filterSection(panel);
    panel.addEventListener('click', handleClick);
    const observer = new MutationObserver(() => {
      templateSection(panel);
      filterSection(panel);
      const filter = panel.querySelector('.scheduled-tasks-filter select');
      const info = panel.querySelector('.scheduled-tasks-filter-info');
      if (filter && info) applyFilter(panel, filter.value, info);
    });
    observer.observe(panel, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => { observer.disconnect(); panel.removeEventListener('click', handleClick); }, { once: true });
  }

  const bootObserver = new MutationObserver(() => {
    const panel = root.document.getElementById(PANEL_ID);
    if (panel && !panel.dataset.enhanced) {
      panel.dataset.enhanced = 'true';
      observePanel(panel);
    }
  });
  if (root.document) {
    bootObserver.observe(root.document.documentElement, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => bootObserver.disconnect(), { once: true });
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
