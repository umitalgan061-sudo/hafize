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
    const target = root.document.querySelector(`#${PANEL_ID} .scheduled-tasks-status`);
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
    const target = event.target?.closest?.('[data-template-task]');
    if (!target) return;
    const textarea = root.document.querySelector(`#${PANEL_ID} .scheduled-tasks-create textarea`);
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

  function addBulk(panel) {
    const list=panel.querySelector('.scheduled-tasks-list'); if(!list||list.querySelector('.scheduled-tasks-bulk')) return;
    const rows=[...list.querySelectorAll('.scheduled-task-row')];
    rows.forEach(row=>{
      if(row.querySelector('[data-schedule-select]')) return;
      const box=root.document.createElement('input'); box.type='checkbox'; box.dataset.scheduleSelect=row.dataset.scheduleId||''; box.setAttribute('aria-label','Görevi seç');
      row.prepend(box);
      box.addEventListener('change',()=>updateBulk(panel));
    });
    updateBulk(panel);
  }

  function selected(panel){return [...panel.querySelectorAll('[data-schedule-select]:checked')].slice(0,40);}

  function updateBulk(panel){
    const old=panel.querySelector('.scheduled-tasks-bulk'); old?.remove();
    const chosen=selected(panel); if(!chosen.length) return;
    const bar=make('div',undefined,'scheduled-tasks-bulk');
    const label=make('span',chosen.length+' görev seçildi','scheduled-tasks-bulk-count');
    const pause=make('button','Duraklat','mini-btn'); pause.type='button'; pause.dataset.bulkAction='pause';
    const resume=make('button','Sürdür','mini-btn'); resume.type='button'; resume.dataset.bulkAction='resume';
    const cancel=make('button','İptal et','mini-btn'); cancel.type='button'; cancel.dataset.bulkAction='cancel';
    const clear=make('button','Seçimi temizle','mini-btn'); clear.type='button'; clear.dataset.bulkAction='clear';
    bar.append(label,pause,resume,cancel,clear);
    list.prepend(bar);
    bar.addEventListener('click',event=>runBulk(panel,event));
  }

  async function runBulk(panel,event){
    const action=event.target?.closest?.('[data-bulk-action]')?.dataset.bulkAction; if(!action) return;
    if(action==='clear'){panel.querySelectorAll('[data-schedule-select]').forEach(node=>{node.checked=false;}); updateBulk(panel); return;}
    const chosen=selected(panel); if(!chosen.length) return;
    if(action==='cancel'&&!root.confirm?.(chosen.length+' seçili görev iptal edilsin mi?')) return;
    let changed=0,failed=0;
    for(const node of chosen){
      const id=node.dataset.scheduleSelect; if(!id) continue;
      const row=node.closest('.scheduled-task-row'); const frequency=row?.dataset.recurrenceFrequency||''; const statusValue=row?.dataset.status||'';
      if((action==='pause'||action==='resume')&&!frequency){failed++;continue;}
      if(action==='pause'&&statusValue!=='scheduled'){failed++;continue;}
      if(action==='resume'&&statusValue!=='paused'){failed++;continue;}
      if(action==='cancel'&&statusValue!=='scheduled'&&statusValue!=='paused'){failed++;continue;}
      try{
        if(action==='cancel') await root.fetch('/api/schedules/'+encodeURIComponent(id),{method:'DELETE',credentials:'same-origin',headers:{Accept:'application/json'}});
        else await root.fetch('/api/schedules/'+encodeURIComponent(id),{method:'PATCH',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({action})});
        changed++;
      }catch{failed++;}
    }
    status(changed+' görev güncellendi.'+(failed?' '+failed+' görev güncellenemedi.':''),failed?'error':'success');
    if(root.ScheduledTasksWorkspace?.refresh) await root.ScheduledTasksWorkspace.refresh();
  }

  const oldEnhance=enhance;
  enhance=function(panel){oldEnhance(panel);addBulk(panel);};
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
