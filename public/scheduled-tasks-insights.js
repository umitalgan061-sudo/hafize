(function installScheduledTaskInsights(root){
  'use strict';
  const PANEL_ID='scheduledTasksWorkspace';
  const STATE_KEY='hafize.scheduled-tasks-insights.v1';
  const MAX_QUERY=100;
  const MAX_EXPORT=256000;
  const SORTS=['next','newest','oldest'];
  const make=(tag,text,className)=>{const node=root.document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;};
  const button=(label,action,className='mini-btn')=>{const node=make('button',label,className);node.type='button';node.dataset.scheduleInsightAction=action;return node;};
  const readState=()=>{try{const raw=JSON.parse(root.sessionStorage?.getItem(STATE_KEY)||'{}');return {query:typeof raw.query==='string'?raw.query.slice(0,MAX_QUERY):'',frequency:['all','daily','weekly','monthly'].includes(raw.frequency)?raw.frequency:'all',recurringOnly:raw.recurringOnly===true,sort:SORTS.includes(raw.sort)?raw.sort:'next'};}catch{return {query:'',frequency:'all',recurringOnly:false,sort:'next'};}};
  const writeState=(state)=>{try{root.sessionStorage?.setItem(STATE_KEY,JSON.stringify(state));}catch{}};
  const rowTask=(row)=>row.querySelector('.scheduled-task-row-head strong')?.textContent?.trim()||'';
  const rowHistoryCount=(row)=>row.querySelectorAll('.scheduled-task-history-row').length;
  const apply=(panel,state)=>{
    const statusSelect=panel.querySelector('.scheduled-tasks-filter select');
    const rows=[...panel.querySelectorAll('.scheduled-task-row')];
    const q=state.query.toLocaleLowerCase('tr-TR');
    let matching=0,recurring=0,paused=0,failedRuns=0;
    rows.forEach((row)=>{
      const task=rowTask(row).toLocaleLowerCase('tr-TR');
      const frequency=row.dataset.recurrenceFrequency||'';
      const status=row.dataset.status||'';
      const matchQuery=!q||task.includes(q);
      const matchFrequency=state.frequency==='all'||frequency===state.frequency;
      const matchRecurring=!state.recurringOnly||Boolean(frequency);
      const selectedStatus=statusSelect?.value||'all';
      const matchStatus=selectedStatus==='all'||status===selectedStatus;
      const visible=matchQuery&&matchFrequency&&matchRecurring&&matchStatus;
      row.hidden=!visible;
      row.dataset.insightsHidden=visible?'false':'true';
      if(matchQuery&&matchFrequency&&matchRecurring){matching+=1;if(frequency)recurring+=1;if(status==='paused')paused+=1;failedRuns+=rowHistoryCount(row);}
    });
    rows.sort((a,b)=>{
      const av=state.sort==='newest'?(a.dataset.createdAt||''):state.sort==='oldest'?(a.dataset.createdAt||''):a.dataset.runAt||'';
      const bv=state.sort==='newest'?(b.dataset.createdAt||''):state.sort==='oldest'?(b.dataset.createdAt||''):b.dataset.runAt||'';
      return state.sort==='oldest'?av.localeCompare(bv):bv.localeCompare(av);
    });
    const list=panel.querySelector('.scheduled-tasks-list');
    if(list) rows.forEach(row=>list.append(row));
    const values=panel.querySelector('.scheduled-task-insights-values');
    if(values){values.querySelector('[data-metric="matching"]').textContent=String(matching);values.querySelector('[data-metric="recurring"]').textContent=String(recurring);values.querySelector('[data-metric="paused"]').textContent=String(paused);values.querySelector('[data-metric="history"]').textContent=String(failedRuns);}
    const info=panel.querySelector('.scheduled-task-insights-status');if(info)info.textContent=matching+' görev ölçütlere uyuyor.';
  };
  const exportSchedules=(panel)=>{const rows=[...panel.querySelectorAll('.scheduled-task-row')];const items=rows.map(row=>({scheduleId:row.dataset.scheduleId||'',status:row.dataset.status||'',nextRunAt:row.dataset.runAt||'',createdAt:row.dataset.createdAt||'',recurrenceFrequency:row.dataset.recurrenceFrequency||null,task:(rowTask(row)||'').slice(0,240)}));const text=JSON.stringify({version:1,source:'hafize-scheduled-task-plan',exportedAt:new Date().toISOString(),items},null,2);if(text.length>MAX_EXPORT)return status(panel,'Görev planı 256 KB sınırını aşıyor.');const blob=new Blob([text],{type:'application/json;charset=utf-8'});const url=root.URL.createObjectURL(blob);const link=make('a');link.href=url;link.download='hafize-scheduled-task-plan.json';link.click();root.setTimeout?.(()=>root.URL.revokeObjectURL(url),0);status(panel,'Görev planı dışa aktarıldı.');};

  const exportHistory=(panel)=>{
    const rows=[...panel.querySelectorAll('.scheduled-task-row')];
    const items=rows.map(row=>({scheduleId:row.dataset.scheduleId||'',status:row.dataset.status||'',recurrenceFrequency:row.dataset.recurrenceFrequency||null,nextRunAt:row.dataset.runAt||'',history:[...row.querySelectorAll('.scheduled-task-history-row')].map(line=>line.textContent?.trim()||'')})).filter(item=>item.history.length||item.recurrenceFrequency);
    const text=JSON.stringify({version:1,source:'hafize-scheduled-task-history-summary',exportedAt:new Date().toISOString(),items},null,2);
    if(text.length>MAX_EXPORT)return status(panel,'Geçmiş özeti 256 KB sınırını aşıyor.');
    const blob=new Blob([text],{type:'application/json;charset=utf-8'});const url=root.URL.createObjectURL(blob);const link=make('a');link.href=url;link.download='hafize-scheduled-task-history.json';link.click();root.setTimeout?.(()=>root.URL.revokeObjectURL(url),0);status(panel,'Görev geçmişi özeti dışa aktarıldı.');
  };
  const status=(panel,message)=>{const node=panel.querySelector('.scheduled-tasks-status');if(node){node.textContent=String(message).slice(0,220);node.dataset.tone='info';}};
  const render=(panel)=>{
    if(panel.querySelector('.scheduled-task-insights'))return;
    const state=readState();
    const section=make('section',undefined,'scheduled-task-insights');section.setAttribute('aria-label','Görev istatistikleri ve filtreleri');
    const head=make('div',undefined,'scheduled-task-insights-head');head.append(make('strong','Görev görünümü','scheduled-tasks-section-title'),button('Sıfırla','reset'),button('Planı dışa aktar','export-plan'),button('Geçmişi dışa aktar','export'));
    const values=make('div',undefined,'scheduled-task-insights-values');
    [['matching','0','Eşleşen'],['recurring','0','Tekrarlı'],['paused','0','Duraklatılan'],['history','0','Geçmiş satırı']].forEach(([key,value,label])=>{const item=make('div',undefined,'scheduled-task-insight-metric');item.append(make('strong',value));item.firstChild.dataset.metric=key;item.append(make('span',label));values.append(item);});
    const controls=make('div',undefined,'scheduled-task-insights-controls');
    const search=root.document.createElement('input');search.type='search';search.maxLength=MAX_QUERY;search.placeholder='Görevlerde ara…';search.value=state.query;search.setAttribute('aria-label','Görevlerde ara');
    const frequency=root.document.createElement('select');frequency.setAttribute('aria-label','Tekrar sıklığına göre filtrele');[['all','Tüm sıklıklar'],['daily','Günlük'],['weekly','Haftalık'],['monthly','Aylık']].forEach(([v,l])=>{const o=make('option',l);o.value=v;frequency.append(o);});frequency.value=state.frequency;
    const sort=root.document.createElement('select');sort.setAttribute('aria-label','Görevleri sırala');[['next','Sonraki çalışma'],['newest','Yeni'],['oldest','Eski']].forEach(([v,l])=>{const o=make('option',l);o.value=v;sort.append(o);});sort.value=state.sort;
    const recurring=button('Yalnız tekrarlı','toggle-recurring');recurring.setAttribute('aria-pressed',String(state.recurringOnly));
    controls.append(search,frequency,sort,recurring);
    const info=make('div','', 'scheduled-task-insights-status');
    section.append(head,controls,values,info);panel.querySelector('.scheduled-tasks-list-section')?.prepend(section);
    const update=()=>{const next={query:search.value.slice(0,MAX_QUERY),frequency:frequency.value,recurringOnly:recurring.getAttribute('aria-pressed')==='true',sort:sort.value};writeState(next);apply(panel,next);};
    search.addEventListener('input',update);frequency.addEventListener('change',update);sort.addEventListener('change',update);
    recurring.addEventListener('click',()=>{recurring.setAttribute('aria-pressed',String(recurring.getAttribute('aria-pressed')!=='true'));update();});
    head.addEventListener('click',event=>{const action=event.target?.closest?.('[data-schedule-insight-action]')?.dataset.scheduleInsightAction;if(action==='reset'){search.value='';frequency.value='all';sort.value='next';recurring.setAttribute('aria-pressed','false');update();status(panel,'Görev filtreleri sıfırlandı.');}if(action==='export-plan')exportSchedules(panel);if(action==='export')exportHistory(panel);});
    panel.querySelector('.scheduled-tasks-filter select')?.addEventListener('change',()=>apply(panel,readState()));
    apply(panel,state);
  };
  const boot=()=>{if(!root.document)return;const observer=new MutationObserver(()=>{const panel=root.document.getElementById(PANEL_ID);if(panel)render(panel);});observer.observe(root.document.documentElement,{childList:true,subtree:true});const panel=root.document.getElementById(PANEL_ID);if(panel)render(panel);root.addEventListener('beforeunload',()=>observer.disconnect(),{once:true});};
  if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(typeof globalThis!=='undefined'?globalThis:self);
