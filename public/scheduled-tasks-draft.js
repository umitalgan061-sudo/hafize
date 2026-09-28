(function installScheduledTaskDraft(root){
  'use strict';
  const PANEL_ID='scheduledTasksWorkspace';
  const STORAGE_KEY='hafize.scheduled-tasks-draft.v1';
  const MAX_TASK=6000;
  const MAX_JSON=12000;
  let attached=null;
  let observer=null;
  const read=()=>{try{const value=JSON.parse(root.sessionStorage?.getItem(STORAGE_KEY)||'null');return value&&typeof value==='object'?value:null;}catch{return null;}};
  const write=(value)=>{try{root.sessionStorage?.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}};
  const clear=()=>{try{root.sessionStorage?.removeItem(STORAGE_KEY);}catch{}};
  const fields=(panel)=>({
    task:panel.querySelector('.scheduled-tasks-create textarea'),
    agent:panel.querySelector('#scheduledTaskAgent'),
    attempts:panel.querySelector('.scheduled-tasks-create select[aria-label="Maksimum deneme sayısı"]'),
    recurrence:panel.querySelector('#scheduledTaskRecurrence'),
    interval:panel.querySelector('input[aria-label="Tekrar aralığı"]'),
    monthDay:panel.querySelector('input[aria-label="Ayın çalışma günü"]'),
    days:[...panel.querySelectorAll('input[data-recurrence-day]')]
  });
  const snapshot=(panel)=>{const f=fields(panel);return {task:String(f.task?.value||'').slice(0,MAX_TASK),agent:String(f.agent?.value||'').slice(0,120),attempts:String(f.attempts?.value||'1').slice(0,2),recurrence:String(f.recurrence?.value||'once').slice(0,12),interval:String(f.interval?.value||'1').slice(0,2),monthDay:String(f.monthDay?.value||'1').slice(0,2),days:f.days.filter(x=>x.checked).map(x=>Number(x.value)).filter(x=>Number.isInteger(x)).slice(0,7)};};
  const hasContent=(value)=>Boolean(value&&typeof value.task==='string'&&value.task.trim());
  const persist=(panel)=>{const value=snapshot(panel);if(!hasContent(value))return clear();const text=JSON.stringify(value);if(text.length<=MAX_JSON)write(value);};
  const restore=(panel)=>{const saved=read();if(!hasContent(saved))return;const f=fields(panel);if(f.task?.value.trim())return; if(f.task)f.task.value=saved.task.slice(0,MAX_TASK);if(f.agent&&saved.agent)f.agent.value=saved.agent;if(f.attempts)f.attempts.value=saved.attempts||'1';if(f.recurrence){f.recurrence.value=['once','daily','weekly','monthly'].includes(saved.recurrence)?saved.recurrence:'once';f.recurrence.dispatchEvent(new Event('change',{bubbles:true}));}if(f.interval)f.interval.value=saved.interval||'1';if(f.monthDay)f.monthDay.value=saved.monthDay||'1';f.days.forEach(node=>{node.checked=Array.isArray(saved.days)&&saved.days.includes(Number(node.value));});};
  const attach=(panel)=>{
    if(attached===panel)return;
    attached=panel;
    const f=fields(panel);
    restore(panel);
    const save=()=>persist(panel);
    f.task?.addEventListener('input',save);
    f.agent?.addEventListener('change',save);
    f.attempts?.addEventListener('change',save);
    f.recurrence?.addEventListener('change',save);
    f.interval?.addEventListener('input',save);
    f.monthDay?.addEventListener('input',save);
    f.days.forEach(node=>node.addEventListener('change',save));
    panel.addEventListener('hafize:scheduled-task-created',clear);
    panel.querySelector('[data-task-action="close"]')?.addEventListener('click',()=>persist(panel));
  };
  const boot=()=>{if(!root.document)return;const scan=()=>{const panel=root.document.getElementById(PANEL_ID);if(panel)attach(panel);};observer=new MutationObserver(scan);observer.observe(root.document.documentElement,{childList:true,subtree:true});scan();root.addEventListener('hafize:scheduled-task-created',clear);root.addEventListener('beforeunload',()=>observer?.disconnect(),{once:true});};
  if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(typeof globalThis!=='undefined'?globalThis:self);
