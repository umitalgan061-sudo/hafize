// TypeScript migration wave 2026-09.
// Behavior is preserved while the browser module moves behind the typed Vite boundary.
// @ts-nocheck
import {summarizeScheduleRuntime} from './schedule-runtime-card.ts';
(function installScheduledTasksWorkspace(root) {
  'use strict';

  const API_PATH = '/api/schedules';
  const PANEL_ID = 'scheduledTasksWorkspace';
  const MAX_TASK = 200_000;
  const MAX_LIST = 10000;
  const MAX_ATTEMPTS = 5;
  const REFRESH_MS = 30_000;
  let panel = null;
  let mounted = false;
  let refreshTimer = 0;
  let lastFocus = null;
  let selectedStatus = 'all';
  let controller = null;
  let nextCursor=null, listGeneration=0, listLoading=false, mutationPending=false;
  let loadedIds=new Set();
  let runtimeAbort=null, runtimeGeneration=0;
  async function refreshRuntime(){
    if(!panel||panel.hidden)return;
    const card=panel.querySelector('#scheduleRuntimeCard');if(!card)return;
    runtimeAbort?.abort();const request=new AbortController();runtimeAbort=request;const ticket=++runtimeGeneration;
    const status=card.querySelector('#scheduleRuntimeState');const list=card.querySelector('#scheduleRuntimeSignals');const refresh=card.querySelector('#scheduleRuntimeRefresh');
    refresh.disabled=true;card.setAttribute('aria-busy','true');status.textContent='Görev motoru durumu alınıyor…';
    const timer=setTimeout(()=>request.abort(),12000);
    let report;
    try{const response=await (root.HafizeAuth?.fetch||root.fetch.bind(root))('/api/health',{cache:'no-store',signal:request.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('HEALTH_UNAVAILABLE');report=summarizeScheduleRuntime(await response.json());}catch{report=summarizeScheduleRuntime(null);}finally{clearTimeout(timer);}
    if(ticket!==runtimeGeneration||panel.hidden)return;
    status.textContent=report.summary;status.dataset.state=report.state;list.replaceChildren();
    for(const row of report.signals){const item=make('li',undefined,'schedule-runtime-signal');item.dataset.state=row.state;item.append(make('strong',row.label+' · '+({configured:'Yapılandırılmış',missing:'Eksik',unknown:'Bilinmiyor'}[row.state])),make('small',row.detail));list.append(item);}
    refresh.disabled=false;card.removeAttribute('aria-busy');runtimeAbort=null;
  }

  const doc = () => root.document;
  const make = (tag, text, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const button = (label, action, className = 'soft-btn') => {
    const node = make('button', label, className);
    node.type = 'button';
    if (action) node.dataset.taskAction = action;
    return node;
  };
  const clamp = (value, limit) => String(value ?? '').slice(0, limit);
  const statusText = (value) => ({ scheduled: 'Planlandı', running: 'Çalışıyor', completed: 'Tamamlandı', failed: 'Başarısız', cancelled: 'İptal edildi' })[value] || 'Bilinmiyor';
  const safeJson = async (response) => { try { return await response.json(); } catch { return null; } };

  async function request(path = API_PATH, options = {}) {
    controller?.abort?.();
    controller = typeof AbortController === 'function' ? new AbortController() : null;
    const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    const response = await (root.HafizeAuth?.fetch||root.fetch.bind(root))(path, { ...options, credentials: 'same-origin', headers, signal: controller?.signal });
    const payload = await safeJson(response);
    if (!response.ok) {
      const error = new Error(payload?.code || payload?.error || `HTTP_${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload || {};
  }

  function agentOptions() {
    const select = doc().getElementById('agentSelect');
    return select ? [...select.options].filter((option) => option.value).map((option) => ({ id: option.value, label: option.textContent?.trim() || option.value })) : [];
  }

  function localDateTimeValue(offsetMinutes = 5) {
    const date = new Date(Date.now() + offsetMinutes * 60_000);
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function isoFromLocal(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function formattedDate(value) {
    const timestamp = Date.parse(value || '');
    return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : 'Tarih bilinmiyor';
  }

  function status(message, tone = '') {
    const target = panel?.querySelector('.scheduled-tasks-status');
    if (!target) return;
    target.textContent = clamp(message, 220);
    target.dataset.tone = tone;
  }

  function build() {
    panel = make('section', undefined, 'scheduled-tasks-overlay');
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'scheduledTasksTitle');

    const shell = make('div', undefined, 'scheduled-tasks-shell');
    const head = make('div', undefined, 'scheduled-tasks-head');
    const title = make('strong', 'Zamanlanmış görevler', 'scheduled-tasks-title');
    title.id = 'scheduledTasksTitle';
    head.append(title, button('Yenile', 'refresh', 'mini-btn'), button('Kapat', 'close', 'mini-btn'));

    const create = make('form', undefined, 'scheduled-tasks-create');
    create.noValidate = true;
    const heading = make('div', 'Yeni görev planla', 'scheduled-tasks-section-title');
    const agentLabel = make('label', 'Ajan');
    const agent = doc().createElement('select');
    agent.id = 'scheduledTaskAgent';
    agent.required = true;
    agent.setAttribute('aria-label', 'Zamanlanmış görev ajanı');
    agentOptions().forEach((item) => { const option = make('option', item.label); option.value = item.id; agent.append(option); });
    if (!agent.options.length) { const option = make('option', 'Ajanlar yükleniyor'); option.value = ''; agent.append(option); agent.disabled = true; }
    agentLabel.append(agent);

    const taskLabel = make('label', 'Görev metni');
    const task = doc().createElement('textarea');
    task.rows = 5; task.maxLength = MAX_TASK; task.required = true; task.placeholder = 'Örn. Bugünkü önemli gelişmeleri özetle ve takip edilmesi gereken noktaları çıkar.'; task.setAttribute('aria-label', 'Zamanlanacak görev metni');
    taskLabel.append(task);

    const whenLabel = make('label', 'Çalıştırma zamanı');
    const when = doc().createElement('input');
    when.type = 'datetime-local'; when.required = true; when.value = localDateTimeValue(); when.min = localDateTimeValue(); whenLabel.append(when);

    const attemptsLabel = make('label', 'Maksimum deneme');
    const attempts = doc().createElement('select'); attempts.setAttribute('aria-label', 'Maksimum deneme sayısı');
    for (let i = 1; i <= MAX_ATTEMPTS; i += 1) { const option = make('option', i); option.value = String(i); attempts.append(option); }
    attemptsLabel.append(attempts);

    const grid = make('div', undefined, 'scheduled-tasks-form-grid'); grid.append(agentLabel, whenLabel, attemptsLabel);
    const submit = button('Görevi planla', 'create'); submit.classList.add('primary');
    create.append(heading, taskLabel, grid, submit);

    const listSection = make('section', undefined, 'scheduled-tasks-list-section');
    listSection.setAttribute('aria-label', 'Planlanmış görevler listesi');
    listSection.append(make('div', 'Planlanan görevler', 'scheduled-tasks-section-title'));
    const filter = make('div', undefined, 'scheduled-tasks-filter');
    const filterSelect = doc().createElement('select'); filterSelect.setAttribute('aria-label', 'Görev durumuna göre filtrele');
    [['all','Tümü'],['scheduled','Planlandı'],['running','Çalışıyor'],['completed','Tamamlandı'],['failed','Başarısız'],['cancelled','İptal edildi']].forEach(([value,label]) => { const option = make('option', label); option.value = value; filterSelect.append(option); });
    const filterInfo = make('span', '', 'scheduled-tasks-filter-info'); filter.append(filterSelect, filterInfo);
    const list = make('div', undefined, 'scheduled-tasks-list'); list.setAttribute('role','list');
    const more=button('Daha fazla görev yükle','more','mini-btn');more.hidden=true;
    listSection.append(filter, list,more);
    const statusNode = make('div', '', 'scheduled-tasks-status'); statusNode.setAttribute('role','status'); statusNode.setAttribute('aria-live','polite');
    const runtimeCard=make('section',undefined,'schedule-runtime-card');runtimeCard.id='scheduleRuntimeCard';runtimeCard.setAttribute('aria-labelledby','scheduleRuntimeTitle');
    const runtimeTitle=make('strong','Görev motoru');runtimeTitle.id='scheduleRuntimeTitle';
    const runtimeStatus=make('p','Görev motoru durumu henüz alınmadı.');runtimeStatus.id='scheduleRuntimeState';runtimeStatus.setAttribute('role','status');
    const runtimeList=make('ul',undefined,'schedule-runtime-signals');runtimeList.id='scheduleRuntimeSignals';
    const runtimeRefresh=button('Motor durumunu yenile','','mini-btn');runtimeRefresh.id='scheduleRuntimeRefresh';runtimeRefresh.addEventListener('click',()=>void refreshRuntime());
    runtimeCard.append(runtimeTitle,runtimeStatus,runtimeList,runtimeRefresh);
    shell.append(head, runtimeCard, create, statusNode, listSection); panel.append(shell); doc().body.append(panel);

    create.addEventListener('submit', async (event) => {
      event.preventDefault();
      const taskText = task.value.trim();
      const runAt = isoFromLocal(when.value);
      if (!agent.value) return status('Geçerli bir ajan seçmelisin.', 'error');
      if (!taskText) return status('Görev metni boş olamaz.', 'error');
      if (!runAt || Date.parse(runAt) <= Date.now()) return status('Çalıştırma zamanı gelecekte olmalı.', 'error');
      submit.disabled = true;mutationPending=true;
      try {
        await request(API_PATH, { method: 'POST', body: JSON.stringify({ agentId: agent.value, task: taskText, runAt, maxAttempts: Number(attempts.value) }) });
        task.value = ''; when.value = localDateTimeValue(); status('Görev planlandı.', 'success'); mutationPending=false; await refresh();
      } catch (error) {
        status(error.status === 401 ? 'Oturum açılması gerekiyor.' : error.message === 'SCHEDULE_CAPACITY_REACHED' ? 'Görev kapasitesi dolu.' : 'Görev planlanamadı.', 'error');
      } finally { submit.disabled = false;mutationPending=false; }
    });

    filterSelect.addEventListener('change', () => { selectedStatus = filterSelect.value; void refresh(); });
    panel.addEventListener('click', onClick);
    panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    panel.addEventListener('click', (event) => { if (event.target === panel) close(); });
  }

  function row(entry) {
    const item = make('article', undefined, 'scheduled-task-row');
    item.dataset.scheduleId = clamp(entry.scheduleId, 120); item.dataset.status = entry.status; item.dataset.runAt = clamp(entry.runAt, 40); item.dataset.agentId = clamp(entry.agentId, 120); item.dataset.maxAttempts = String(Math.max(1, Math.min(MAX_ATTEMPTS, Number(entry.maxAttempts) || 1)));
    item.setAttribute('role','listitem');
    const head = make('div', undefined, 'scheduled-task-row-head');
    const title = make('strong', clamp(entry.task, 120));
    const badge = make('span', statusText(entry.status), `scheduled-task-status status-${entry.status}`); head.append(title, badge);
    const meta = make('div', `${formattedDate(entry.runAt)} · ${clamp(entry.agentId, 80)} · deneme ${entry.attempts}/${entry.maxAttempts}`, 'scheduled-task-meta');
    const detail = make('p', entry.lastError ? `Son hata: ${clamp(entry.lastError, 120)}` : entry.status === 'completed' ? 'Başarıyla tamamlandı.' : '');
    const actions = make('div', undefined, 'scheduled-task-actions');
    if (entry.status === 'scheduled') actions.append(button('İptal et','cancel','mini-btn'));
    const trace = button('Trace ID','trace','mini-btn'); trace.title = clamp(entry.traceId, 128); trace.setAttribute('aria-label', `Trace ID: ${clamp(entry.traceId, 40)}`); actions.append(trace);
    item.append(head, meta, detail, actions);
    return item;
  }

  function applyFilter(list, info) {
    let visible = 0;
    [...list.children].forEach((node) => { if (!node.classList.contains('scheduled-task-row')) return; const show = selectedStatus === 'all' || node.dataset.status === selectedStatus; node.hidden = !show; if (show) visible += 1; });
    const total=Number(panel?.dataset.scopeTotal);info.textContent=Number.isSafeInteger(total)&&total>=visible?`${visible} / ${total} görev gösteriliyor.`:`${visible} görev gösteriliyor.`;
  }

  async function refresh(append=false) {
    if(mutationPending||panel?.hidden||append&&(listLoading||!nextCursor))return;
    const list=panel?.querySelector('.scheduled-tasks-list'),info=panel?.querySelector('.scheduled-tasks-filter-info'),more=panel?.querySelector('[data-task-action="more"]');
    if(!list)return;
    const ticket=++listGeneration;listLoading=true;if(more)more.disabled=true;
    const params=new URLSearchParams({scope:selectedStatus,limit:'100'});
    if(append)params.set('cursor',nextCursor);
    else {nextCursor=null;loadedIds=new Set();delete panel.dataset.scopeCounts;delete panel.dataset.scopeTotal;list.replaceChildren(make('div','Görevler yükleniyor…','scheduled-tasks-empty'));}
    try{
      const payload=await request(API_PATH+'?'+params);
      if(ticket!==listGeneration||panel.hidden)return;
      const entries=Array.isArray(payload.schedules)?payload.schedules.slice(0,MAX_LIST):[];
      const meta=payload.listMeta;
      // Accept the previous backend during rollout, without falsely claiming paginated counts.
      if(meta&&meta.scope===selectedStatus&&meta.scopeCounts&&Number.isSafeInteger(meta.total)&&meta.total>=0){
        panel.dataset.scopeCounts=JSON.stringify(meta.scopeCounts);panel.dataset.scopeTotal=String(meta.total);
        nextCursor=typeof meta.nextCursor==='string'&&meta.nextCursor.length<=800?meta.nextCursor:null;
      }else nextCursor=null;
      if(!append)list.replaceChildren();
      for(const entry of entries){if(!entry?.scheduleId||loadedIds.has(entry.scheduleId))continue;loadedIds.add(entry.scheduleId);list.append(row(entry));}
      if(!loadedIds.size)list.append(make('div','Bu durumda görev yok.','scheduled-tasks-empty'));
      applyFilter(list,info);
    }catch(error){
      if(ticket!==listGeneration||panel.hidden)return;
      if(!append)list.replaceChildren(make('div',error.status===401?'Görevleri görmek için oturum açmalısın.':'Görev listesi yüklenemedi.','scheduled-tasks-empty'));
      status(error.status===401?'Kimlik doğrulama gerekli.':'Görev servisine ulaşılamadı.','error');
    }finally{if(ticket===listGeneration){listLoading=false;if(more){more.hidden=!nextCursor;more.disabled=false;}}}
  }

  async function cancelTask(id) {
    if (!id || !root.confirm?.('Bu planlanmış görev iptal edilsin mi?')) return;
    mutationPending=true;try { await request(`${API_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' }); status('Görev iptal edildi.','success'); }
    catch (error) { status(error.message === 'SCHEDULE_NOT_CANCELLABLE' ? 'Görev artık iptal edilemez.' : 'Görev iptal edilemedi.','error'); }finally{mutationPending=false;await refresh();}
  }

  function onClick(event) {
    const target = event.target?.closest?.('[data-task-action]'); if (!target) return;
    const action = target.dataset.taskAction;
    if (action === 'close') return close();
    if (action === 'refresh') return refresh();
    if (action === 'more') return refresh(true);
    if (action === 'cancel') return cancelTask(target.closest('.scheduled-task-row')?.dataset.scheduleId);
    if (action === 'trace') return status(`Trace ID: ${target.title}`,'info');
  }

  function open() {
    if (!panel) return;
    lastFocus = doc().activeElement; panel.hidden = false; selectedStatus = 'all';
    const filter = panel.querySelector('.scheduled-tasks-filter select'); if (filter) filter.value = 'all';
    refresh(); void refreshRuntime(); clearInterval(refreshTimer); refreshTimer = root.setInterval?.(()=>{if(!listLoading&&loadedIds.size<=100)void refresh();}, REFRESH_MS) || 0;
    panel.querySelector('[data-task-action="close"]')?.focus();
  }

  function close() { if (!panel) return; panel.hidden = true; runtimeGeneration++;runtimeAbort?.abort();runtimeAbort=null; listGeneration++;listLoading=false; clearInterval(refreshTimer); refreshTimer = 0; controller?.abort?.(); lastFocus?.focus?.(); lastFocus = null; }

  function boot() {
    if (mounted || !doc()) return;
    const nav = [...doc().querySelectorAll('.nav-item')].find((node) => node.textContent?.includes('Görevler'));
    if (!nav) return;
    build(); nav.disabled = false; nav.addEventListener('click', open); nav.setAttribute('aria-controls', PANEL_ID); nav.setAttribute('aria-expanded', 'false');
    mounted = true;
  }

  root.ScheduledTasksWorkspace = Object.freeze({ open, close, refresh, request });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
