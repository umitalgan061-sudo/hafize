// TypeScript migration wave 2026-09-30.
// Canonical browser source; @ts-nocheck is temporary while shared browser contracts are introduced.
// @ts-nocheck
(function installScheduledTaskTemplatePresets(root) {
  'use strict';
  const PANEL_ID = 'scheduledTaskTemplates';
  const presets = Object.freeze([
    ['Günlük haber özeti', 'Günün önemli gelişmelerini güvenilir kaynaklardan derle ve kısa bir önceliklendirilmiş özet hazırla.'],
    ['Haftalık plan', 'Önümüzdeki haftanın işleri için uygulanabilir bir plan, öncelikler ve riskler çıkar.'],
    ['Kod incelemesi', 'Son kod değişikliklerini incele; regresyon, güvenlik ve bakım risklerini maddeler halinde belirt.'],
    ['Araştırma notu', 'Belirtilen konuyu araştır; temel bulguları, belirsizlikleri ve takip sorularını kısa bir karar notuna dönüştür.'],
    ['Toplantı özeti', 'Toplantı notlarını eylem maddeleri, sorumlular ve son tarihler halinde düzenle.'],
    ['Kontrol listesi', 'Verilen işi tamamlamak için doğrulanabilir adımlardan oluşan bir kontrol listesi oluştur.']
  ]);
  let mounted = false;
  let panel = null;

  const doc = () => root.document;
  const make = (tag, text, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  function currentAgentId() {
    const form = doc()?.querySelector?.('#scheduledTasksWorkspace .scheduled-tasks-create');
    return form?.querySelector('#scheduledTaskAgent')?.value || '';
  }

  function status(message) {
    const node = doc()?.querySelector?.('#scheduledTasksWorkspace .scheduled-tasks-status');
    if (node) node.textContent = String(message).slice(0, 200);
  }

  function addPreset(name, task) {
    const api = root.ScheduledTaskTemplates;
    if (!api?.add) return status('Görev şablonu modülü kullanılamıyor.');
    const agentId = currentAgentId();
    if (!agentId) return status('Önce bir ajan seçmelisin.');
    const result = api.add({ name, task, agentId, maxAttempts: 1 });
    status(result ? 'Başlangıç şablonu kaydedildi.' : 'Bu şablon zaten var veya kapasite dolu.');
    root.setTimeout?.(() => root.ScheduledTaskTemplateBackup?.boot?.(), 0);
  }

  function build() {
    if (panel) return;
    panel = doc()?.getElementById?.(PANEL_ID);
    if (!panel || panel.querySelector('.scheduled-task-template-presets')) return;
    const section = make('div', undefined, 'scheduled-task-template-presets');
    section.append(make('strong', 'Başlangıç şablonları', 'scheduled-task-template-presets-title'));
    const grid = make('div', undefined, 'scheduled-task-template-presets-grid');
    presets.forEach(function (entry) {
      const button = make('button', undefined, 'mini-btn scheduled-task-template-preset');
      button.type = 'button';
      button.dataset.presetName = entry[0];
      button.dataset.presetTask = entry[1];
      button.append(make('strong', entry[0]), make('span', entry[1]));
      grid.append(button);
    });
    section.append(grid);
    panel.append(section);
    section.addEventListener('click', function (event) {
      const target = event.target?.closest?.('[data-preset-name]');
      if (!target) return;
      addPreset(target.dataset.presetName, target.dataset.presetTask);
    });
  }

  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    build();
    root.addEventListener?.('beforeunload', destroy, { once: true });
  }

  function destroy() {
    panel?.querySelector?.('.scheduled-task-template-presets')?.remove?.();
    panel = null;
    mounted = false;
  }

  root.ScheduledTaskTemplatePresets = Object.freeze({ boot, presets, destroy });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
