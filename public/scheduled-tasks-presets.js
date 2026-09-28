(function installScheduledTaskPresets(root){
  'use strict';
  const STORAGE_KEY='hafize.scheduled-task-presets.v1';
  const MAX_PRESETS=40;
  const MAX_TITLE=80;
  const MAX_TASK=6000;
  const MAX_JSON=256000;
  const CARD='scheduledTasksWorkspace';
  let mounted=false;
  let observer=null;
  let currentPanel=null;

  const make=(tag,text,className)=>{
    const node=root.document.createElement(tag);
    if(className) node.className=className;
    if(text!==undefined) node.textContent=String(text);
    return node;
  };
  const button=(label,action,className='mini-btn')=>{
    const node=make('button',label,className);
    node.type='button';
    node.dataset.schedulePresetAction=action;
    return node;
  };
  const clamp=(value,max)=>String(value??'').trim().slice(0,max);

  function read(){
    try{
      const parsed=JSON.parse(root.localStorage?.getItem(STORAGE_KEY)||'[]');
      if(!Array.isArray(parsed)) return [];
      return parsed.filter(item=>item&&typeof item==='object').slice(0,MAX_PRESETS).map(normalize).filter(Boolean);
    }catch{return [];}
  }
  function write(items){
    try{
      root.localStorage?.setItem(STORAGE_KEY,JSON.stringify(items.slice(0,MAX_PRESETS)));
      return true;
    }catch{return false;}
  }
  function id(){return root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(16).slice(2);}
  function normalize(raw){
    if(!raw||typeof raw!=='object') return null;
    const title=clamp(raw.title,MAX_TITLE);
    const task=clamp(raw.task,MAX_TASK);
    if(!title||!task) return null;
    const recurrence=raw.recurrence&&typeof raw.recurrence==='object'?{
      frequency:['daily','weekly','monthly'].includes(raw.recurrence.frequency)?raw.recurrence.frequency:'daily',
      interval:Number.isInteger(raw.recurrence.interval)?Math.min(30,Math.max(1,raw.recurrence.interval)):1,
      daysOfWeek:Array.isArray(raw.recurrence.daysOfWeek)?raw.recurrence.daysOfWeek.filter(Number.isInteger).filter(x=>x>=0&&x<=6).slice(0,7):[],
      dayOfMonth:Number.isInteger(raw.recurrence.dayOfMonth)?Math.min(31,Math.max(1,raw.recurrence.dayOfMonth)):null
    }:null;
    return Object.freeze({id:clamp(raw.id,120)||id(),title,task,agentId:clamp(raw.agentId,120),maxAttempts:Number.isInteger(raw.maxAttempts)?Math.min(5,Math.max(1,raw.maxAttempts)):1,recurrence,createdAt:clamp(raw.createdAt,40)||new Date().toISOString(),updatedAt:clamp(raw.updatedAt,40)||new Date().toISOString()});
  }
  function form(panel){
    return {
      task:panel.querySelector('.scheduled-tasks-create textarea'),
      agent:panel.querySelector('#scheduledTaskAgent'),
      attempts:panel.querySelector('.scheduled-tasks-create select[aria-label="Maksimum deneme sayısı"]'),
      recurrence:panel.querySelector('#scheduledTaskRecurrence'),
      interval:panel.querySelector('.scheduled-tasks-create input[type="number"][aria-label="Tekrar aralığı"]'),
      monthDay:panel.querySelector('.scheduled-tasks-create input[type="number"][aria-label="Ayın çalışma günü"]'),
      days:[...panel.querySelectorAll('input[data-recurrence-day]')]
    };
  }
  function currentForm(panel){
    const fields=form(panel);
    const task=clamp(fields.task?.value,MAX_TASK);
    if(!task) return null;
    const frequency=fields.recurrence?.value;
    let recurrence=null;
    if(frequency&&frequency!=='once'){
      recurrence={frequency,interval:Math.min(30,Math.max(1,Number(fields.interval?.value)||1))};
      if(frequency==='weekly') recurrence.daysOfWeek=fields.days.filter(node=>node.checked).map(node=>Number(node.value));
      if(frequency==='monthly') recurrence.dayOfMonth=Math.min(31,Math.max(1,Number(fields.monthDay?.value)||1));
    }
    return {title:task.slice(0,MAX_TITLE),task,agentId:fields.agent?.value||'',maxAttempts:Number(fields.attempts?.value)||1,recurrence};
  }
  function status(message){
    const node=currentPanel?.querySelector('.scheduled-tasks-status');
    if(node){node.textContent=clamp(message,220);node.dataset.tone='info';}
  }
  function usePreset(panel,preset){
    const fields=form(panel);
    if(fields.task) fields.task.value=preset.task;
    if(fields.agent&&preset.agentId) fields.agent.value=preset.agentId;
    if(fields.attempts) fields.attempts.value=String(preset.maxAttempts);
    if(fields.recurrence){
      fields.recurrence.value=preset.recurrence?.frequency||'once';
      fields.recurrence.dispatchEvent(new Event('change',{bubbles:true}));
    }
    if(preset.recurrence){
      if(fields.interval) fields.interval.value=String(preset.recurrence.interval||1);
      if(fields.monthDay&&preset.recurrence.frequency==='monthly') fields.monthDay.value=String(preset.recurrence.dayOfMonth||1);
      fields.days.forEach(node=>{node.checked=preset.recurrence.frequency==='weekly'&&(preset.recurrence.daysOfWeek||[]).includes(Number(node.value));});
    }else fields.days.forEach(node=>{node.checked=false;});
    fields.task?.focus?.();
    status('Preset görev alanına aktarıldı; planlamayı kullanıcı tamamlar.');
  }
  function render(panel){
    const create=panel.querySelector('.scheduled-tasks-create');
    if(!create||create.querySelector('.scheduled-tasks-presets')) return;
    const section=make('section',undefined,'scheduled-tasks-presets');
    section.setAttribute('aria-label','Yerel görev presetleri');
    const head=make('div',undefined,'scheduled-task-presets-head');
    head.append(make('strong','Görev presetleri','scheduled-tasks-section-title'),button('Yeni','new'));
    const list=make('div',undefined,'scheduled-task-presets-list');
    const items=read();
    if(!items.length) list.append(make('div','Henüz kaydedilmiş preset yok.','scheduled-task-presets-empty'));
    items.forEach(item=>{
      const row=make('div',undefined,'scheduled-task-preset-row');
      const meta=make('div',undefined,'scheduled-task-preset-meta');
      meta.append(make('strong',item.title),make('span',item.recurrence?item.recurrence.frequency:'Tek sefer'));
      const actions=make('div',undefined,'scheduled-task-preset-actions');
      const use=button('Kullan','use'); use.dataset.schedulePresetId=item.id;
      const remove=button('Sil','delete'); remove.dataset.schedulePresetId=item.id;
      actions.append(use,remove); row.append(meta,actions); list.append(row);
    });
    const io=make('div',undefined,'scheduled-task-preset-io');
    const exportBtn=button('Dışa aktar','export');
    const importBtn=button('İçe aktar','import');
    io.append(exportBtn,importBtn);
    const file=root.document.createElement('input'); file.type='file'; file.accept='application/json,.json'; file.hidden=true;
    section.append(head,list,io,file);
    create.append(section);
    head.addEventListener('click',event=>onAction(event,panel));
    list.addEventListener('click',event=>onAction(event,panel));
    io.addEventListener('click',event=>onAction(event,panel));
    file.addEventListener('change',()=>importFile(panel,file.files?.[0]));
    section._presetFile=file;
  }
  function refresh(panel){const section=panel.querySelector('.scheduled-tasks-presets');section?.remove();render(panel);}
  function newPreset(panel){
    const value=currentForm(panel);
    if(!value) return status('Önce görev metni yazmalısın.');
    const title=root.prompt?.('Preset adı:',value.title);
    if(title==null) return;
    const cleanTitle=clamp(title,MAX_TITLE);
    if(!cleanTitle) return status('Preset adı boş olamaz.');
    const items=read().filter(item=>item.title.toLocaleLowerCase('tr-TR')!==cleanTitle.toLocaleLowerCase('tr-TR'));
    const now=new Date().toISOString();
    const item=normalize({...value,id:id(),title:cleanTitle,createdAt:now,updatedAt:now});
    if(!item||!write([item,...items])) return status('Preset kaydedilemedi.');
    refresh(panel); status('Preset cihazda kaydedildi.');
  }
  function deletePreset(panel,idValue){
    const items=read(); const target=items.find(item=>item.id===idValue);
    if(!target||!root.confirm?.('Bu preset silinsin mi?')) return;
    write(items.filter(item=>item.id!==idValue)); refresh(panel); status('Preset silindi.');
  }
  function exportPresets(){
    const payload={version:1,source:'hafize-scheduled-task-presets',exportedAt:new Date().toISOString(),items:read()};
    const text=JSON.stringify(payload,null,2);
    if(text.length>MAX_JSON) return status('Preset yedeği sınırı aşıyor.');
    const blob=new Blob([text],{type:'application/json;charset=utf-8'});
    const url=root.URL.createObjectURL(blob);
    const link=make('a');link.href=url;link.download='hafize-scheduled-task-presets.json';link.click();
    root.setTimeout?.(()=>root.URL.revokeObjectURL(url),0);status('Presetler dışa aktarıldı.');
  }
  function importFile(panel,file){
    if(!file) return;
    if(file.size>MAX_JSON) return status('Preset dosyası 256 KB sınırını aşamaz.');
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const parsed=JSON.parse(String(reader.result||'')); const raw=Array.isArray(parsed)?parsed:parsed?.items;
        if(!Array.isArray(raw)) throw new Error('INVALID_PRESETS');
        const incoming=raw.map(normalize).filter(Boolean);
        const merged=[];const seen=new Set();
        for(const item of [...incoming,...read()]){
          const key=item.title.toLocaleLowerCase('tr-TR');
          if(seen.has(key)) continue;seen.add(key);merged.push(item);if(merged.length>=MAX_PRESETS)break;
        }
        if(!write(merged)) throw new Error('WRITE_FAILED');
        refresh(panel);status(incoming.length+' preset değerlendirildi; mevcutlar korunarak birleştirildi.');
      }catch{status('Geçersiz preset yedeği.');}
    };
    reader.onerror=()=>status('Preset dosyası okunamadı.');
    reader.readAsText(file);
  }
  function onAction(event,panel){
    const target=event.target?.closest?.('[data-schedule-preset-action]');
    if(!target)return;
    const action=target.dataset.schedulePresetAction;
    if(action==='new') return newPreset(panel);
    if(action==='delete') return deletePreset(panel,target.dataset.schedulePresetId||'');
    if(action==='use'){const item=read().find(x=>x.id===target.dataset.schedulePresetId);if(item)usePreset(panel,item);return;}
    if(action==='export') return exportPresets();
    if(action==='import'){panel.querySelector('.scheduled-tasks-presets input[type="file"]')?.click();return;}
  }
  function boot(){
    if(mounted||!root.document)return;
    const scan=()=>{const panel=root.document.getElementById(CARD);if(!panel||panel===currentPanel)return;currentPanel=panel;render(panel);};
    observer=new MutationObserver(scan);observer.observe(root.document.documentElement,{childList:true,subtree:true});scan();
    mounted=true;
    root.addEventListener?.('beforeunload',()=>observer?.disconnect(),{once:true});
  }
  if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(typeof globalThis!=='undefined'?globalThis:self);
