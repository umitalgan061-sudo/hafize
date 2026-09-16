(function enhanceScheduledTasksWorkspace(root) {
  'use strict';

  const PANEL_ID = 'scheduledTasksWorkspace';
  const STATS_SRC = '/scheduled-tasks-stats.js';
  const templates = Object.freeze([
    ['Günlük özet', 'Bugünkü önemli gelişmeleri özetle ve öncelikli maddeleri belirt.'],
    ['Satış özeti', 'Satış verilerini incele; önemli sapmaları ve takip edilmesi gereken noktaları çıkar.'],
    ['Kod incelemesi', 'Projede son değişiklikleri gözden geçir; riskleri, regresyonları ve iyileştirmeleri özetle.'],
    ['Araştırma özeti', 'Belirtilen konu için güvenilir kaynakları incele ve kısa bir karar notu hazırla.'],
    ['Haftalık plan', 'Önümüzdeki hafta için işleri önceliklendir ve uygulanabilir bir çalışma planı çıkar.'],
    ['Kontrol listesi', 'Verilen görev için tamamlanma kontrol listesi oluştur ve kritik adımları işaretle.']
  ]);

  const make = (tag, text, className) => { const node = root.document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; };
  const status = (message, tone = '') => { const target = root.document.querySelector(`#${PANEL_ID} .scheduled-tasks-status`); if (!target) return; target.textContent = String(message).slice(0, 220); target.dataset.tone = tone; };

  function addTemplates(panel) {
    if (panel.querySelector('.scheduled-tasks-template-section')) return;
    const create = panel.querySelector('.scheduled-tasks-create'); if (!create) return;
    const section = make('div', undefined, 'scheduled-tasks-template-section'); section.append(make('div', 'Hızlı şablonlar', 'scheduled-tasks-section-title'));
    const grid = make('div', undefined, 'scheduled-tasks-templates');
    templates.forEach(([title, task]) => { const item = make('button', undefined, 'scheduled-task-template'); item.type = 'button'; item.dataset.templateTask = task; item.append(make('strong', title), make('span', task)); grid.append(item); });
    section.append(grid); create.insertBefore(section, create.querySelector('.scheduled-tasks-form-grid') || null);
  }

  function onTemplate(event) {
    const target = event.target?.closest?.('[data-template-task]'); if (!target) return;
    const textarea = root.document.querySelector(`#${PANEL_ID} .scheduled-tasks-create textarea`); if (!textarea) return;
    textarea.value = target.dataset.templateTask || ''; textarea.focus(); status('Şablon görev metnine aktarıldı.', 'info');
  }

  function loadStatsModule() {
    if (root.document.querySelector(`script[src="${STATS_SRC}"]`) || root.ScheduledTasksStats) return;
    const script = root.document.createElement('script'); script.src = STATS_SRC; script.defer = true; script.dataset.scheduledTaskStats = 'true'; root.document.head.append(script);
  }

  function enhance(panel) { addTemplates(panel); loadStatsModule(); if (!panel.dataset.templateEnhanced) { panel.dataset.templateEnhanced = 'true'; panel.addEventListener('click', onTemplate); } }

  function boot() {
    if (!root.document) return;
    const observer = new MutationObserver(() => { const panel = root.document.getElementById(PANEL_ID); if (panel) enhance(panel); });
    observer.observe(root.document.documentElement, { childList: true, subtree: true });
    root.addEventListener('beforeunload', () => observer.disconnect(), { once: true });
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
