export type Theme = 'light' | 'dark';
export type UiLayout = 'classic' | 'focused';
export interface CalendarCell { readonly day:number; readonly month:number; readonly year:number; readonly outside:boolean; readonly selected:boolean; }
export interface CalendarCursor { readonly year:number; readonly month:number; readonly day:number; }
export interface SidebarDisclosure { readonly isOpen:()=>boolean; readonly close:()=>void; readonly destroy:()=>void; }
export interface UiShellController {
  readonly getTheme:()=>Theme;
  readonly renderCalendar:(options?:{readonly focusSelected?:boolean})=>void;
  readonly sidebarDisclosure: SidebarDisclosure | null;
  readonly destroy:()=>void;
}
const THEME_KEY='hafize.theme.v1';
const LAYOUT_KEY='hafize.ui-layout.v2';
export function resolveUiLayout(stored:unknown):UiLayout{return stored==='classic'?'classic':'focused';}
export const DESKTOP_AGENDA_MEDIA='(min-width: 1041px) and (hover: hover) and (pointer: fine)';
export type DesktopAgendaTask={id:string;title:string;runAt:string;status:string};
export const calendarDateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function parseDesktopAgendaTasks(raw:unknown):DesktopAgendaTask[]{
 if(!Array.isArray(raw))return [];
 const rows=new Map<string,DesktopAgendaTask>();
 for(const item of raw){
  if(!item||typeof item!=='object'||typeof item.scheduleId!=='string'||!item.scheduleId||typeof item.task!=='string'||!item.task.trim()||typeof item.runAt!=='string'||!Number.isFinite(Date.parse(item.runAt))||!['scheduled','running','completed','failed'].includes(item.status))continue;
  rows.set(item.scheduleId,{id:item.scheduleId,title:item.task.slice(0,140),runAt:item.runAt,status:item.status});
 }
 return [...rows.values()].sort((a,b)=>Date.parse(a.runAt)-Date.parse(b.runAt)||a.id.localeCompare(b.id));
}
export function agendaTasksForDate(tasks:readonly DesktopAgendaTask[],date:Date){const key=calendarDateKey(date);return tasks.filter(task=>calendarDateKey(new Date(task.runAt))===key);}
export const WEEKDAYS=Object.freeze(['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']);
export function resolveTheme(stored:unknown,prefersDark:boolean):Theme{return stored==='light'||stored==='dark'?stored:(prefersDark?'dark':'light');}
export function createMonthCells(year:number,month:number,selectedDay:number):readonly CalendarCell[]{
  const first=new Date(year,month,1);const startOffset=(first.getDay()+6)%7;const gridStart=new Date(year,month,1-startOffset);
  return Object.freeze(Array.from({length:42},(_,index)=>{const date=new Date(gridStart);date.setDate(gridStart.getDate()+index);return Object.freeze({day:date.getDate(),month:date.getMonth(),year:date.getFullYear(),outside:date.getMonth()!==month,selected:date.getMonth()===month&&date.getDate()===selectedDay});}));
}
export function moveCalendarDate(year:number,month:number,day:number,key:string):CalendarCursor|null{
 const date=new Date(year,month,day);if(Number.isNaN(date.getTime()))return null;
 switch(key){case'ArrowLeft':date.setDate(date.getDate()-1);break;case'ArrowRight':date.setDate(date.getDate()+1);break;case'ArrowUp':date.setDate(date.getDate()-7);break;case'ArrowDown':date.setDate(date.getDate()+7);break;case'Home':date.setDate(1);break;case'End':date.setMonth(date.getMonth()+1,0);break;default:return null;}
 return Object.freeze({year:date.getFullYear(),month:date.getMonth(),day:date.getDate()});
}
function addListener(target:EventTarget,type:string,listener:EventListener,options?:AddEventListenerOptions):()=>void{target.addEventListener(type,listener,options);return()=>target.removeEventListener(type,listener,options);}
export function installSidebarDisclosure(documentRef:Document):SidebarDisclosure|null{
 const sidebar=documentRef.querySelector<HTMLElement>('#sidebar'),toggle=documentRef.querySelector<HTMLButtonElement>('#sidebarToggle');if(!sidebar||!toggle)return null;
 // Other modules close the sidebar by removing the class directly (e.g. after picking a chat), so the
 // DOM is the source of truth; a cached flag here made the next ☰ tap a no-op.
 const isOpen=()=>sidebar.classList.contains('open');
 const syncToggle=()=>{const open=isOpen();documentRef.body?.classList.toggle('sidebar-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-controls',sidebar.id||'sidebar');toggle.setAttribute('aria-label',open?'Menüyü kapat':'Menüyü aç');};
 const render=(next:boolean,focusToggle=false)=>{sidebar.classList.toggle('open',Boolean(next));syncToggle();if(focusToggle)toggle.focus();};
 const onToggle=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();render(!isOpen());};
 const onKeydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&isOpen()){event.preventDefault();render(false,true);}};
 const Observer=documentRef.defaultView?.MutationObserver;
 const classObserver=Observer?new Observer(syncToggle):null;
 classObserver?.observe(sidebar,{attributes:true,attributeFilter:['class']});
 // The open sidebar floats over the page behind a dimmed backdrop; a tap anywhere outside it closes it.
 // Ctrl/⌘+Shift+F (documented on the settings page): open the sidebar and focus chat search.
 // Registered on the window in the capture phase so the hidden fork shortcut never fires instead.
 const onSearchShortcut=(event:KeyboardEvent)=>{if(!(event.ctrlKey||event.metaKey)||!event.shiftKey||event.altKey||event.key.toLowerCase()!=='f')return;const search=documentRef.querySelector<HTMLInputElement>('#conversationSearchInput');if(!search)return;event.preventDefault();event.stopImmediatePropagation();render(true);search.focus();search.select();};
 const view=documentRef.defaultView;view?.addEventListener('keydown',onSearchShortcut,true);
 const onOutsideClick=(event:Event)=>{const target=event.target as Node|null;if(!isOpen()||!target||sidebar.contains(target)||toggle.contains(target))return;event.preventDefault();event.stopPropagation();render(false);};
 toggle.addEventListener('click',onToggle,true);documentRef.addEventListener('keydown',onKeydown);documentRef.addEventListener('click',onOutsideClick,true);syncToggle();
 return Object.freeze({isOpen,close:()=>render(false),destroy(){classObserver?.disconnect();toggle.removeEventListener('click',onToggle,true);documentRef.removeEventListener('keydown',onKeydown);documentRef.removeEventListener('click',onOutsideClick,true);view?.removeEventListener('keydown',onSearchShortcut,true);}});
}
/** Stable focused layout is the default; advanced mode is an explicit opt-in. */
export function installLayoutMode(documentRef:Document,root:Window&typeof globalThis):()=>void{
 const html=documentRef.documentElement;
 const button=documentRef.querySelector<HTMLButtonElement>('#layoutToggle');
 let stored:unknown=null;
 try{stored=root.localStorage?.getItem(LAYOUT_KEY);}catch{}
 let layout=resolveUiLayout(stored);
 const render=()=>{
  html.dataset.hafizeLayout=layout;
  const classic=layout==='classic';
  button?.setAttribute('aria-pressed',String(classic));
  button?.setAttribute('aria-label',classic?'Sade görünüme geç':'Gelişmiş görünüme geç');
  button?.setAttribute('title',classic?'Sade görünüme geç':'Gelişmiş görünüme geç');
  const label=button?.querySelector<HTMLElement>('[data-layout-label]');
  if(label)label.textContent=classic?'Sade görünüme geç':'Gelişmiş görünüme geç';
 };
 const onClick=()=>{
  layout=layout==='classic'?'focused':'classic';
  try{root.localStorage?.setItem(LAYOUT_KEY,layout);}catch{}
  render();
  root.dispatchEvent(new CustomEvent('hafize:layout-changed',{detail:{layout}}));
 };
 render();
 button?.addEventListener('click',onClick);
 return ()=>button?.removeEventListener('click',onClick);
}
export function installChatAccessibility(documentRef:Document):boolean{
 const stage=documentRef.querySelector<HTMLElement>('.chat-stage'),messages=documentRef.querySelector<HTMLElement>('#messages');if(!messages)return false;
 stage?.removeAttribute('aria-live');messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');messages.setAttribute('aria-relevant','additions text');messages.setAttribute('aria-atomic','false');messages.setAttribute('aria-label','Sohbet mesajları');return true;
}
/** Visual viewport geometry is measured in layout-viewport CSS pixels, never screen pixels. */
export function mobileKeyboardGeometry(layoutHeight:number,visualHeight:number,offsetTop:number,focused:boolean,scale=1){
 const gap=Math.max(0,Math.round(layoutHeight-visualHeight));
 const active=focused&&scale>=0.99&&scale<=1.01&&gap>100;
 return {active,bottom:active?Math.max(0,Math.round(layoutHeight-visualHeight-Math.max(0,offsetTop))):0};
}
export function install(documentRef:Document,root:Window&typeof globalThis):UiShellController|null{
 const html=documentRef.documentElement;if(!html)return null;
 const disposers:(()=>void)[]=[installLayoutMode(documentRef,root)];const sidebarDisclosure=installSidebarDisclosure(documentRef);if(sidebarDisclosure)disposers.push(sidebarDisclosure.destroy);
 installChatAccessibility(documentRef);
 const storage=root.localStorage,media=root.matchMedia('(prefers-color-scheme: dark)');
 let theme=resolveTheme(storage?.getItem(THEME_KEY),Boolean(media.matches));
 const themeToggle=documentRef.querySelector<HTMLButtonElement>('#themeToggle');
 const paintTheme=(next:Theme)=>{
  // A single cross-fade instead of every surface animating on its own, where the browser can do it.
  const docWithTransition=documentRef as Document&{startViewTransition?:(update:()=>void)=>unknown};
  const calm=documentRef.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const apply=()=>{theme=next;html.dataset.theme=next;};
  if(html.dataset.theme&&html.dataset.theme!==next&&!calm&&docWithTransition.startViewTransition)docWithTransition.startViewTransition(apply);else apply();
  themeToggle?.setAttribute('aria-pressed',String(next==='dark'));themeToggle?.setAttribute('title',next==='dark'?'Gündüz moduna geç':'Gece moduna geç');documentRef.querySelector('meta[name="theme-color"]')?.setAttribute('content',next==='dark'?'#202122':'#f7f5f0');};
 paintTheme(theme);
 // The settings page can change the theme too, so read the live value rather than the cached one,
 // and announce the change so its theme picker stays in sync.
 if(themeToggle)disposers.push(addListener(themeToggle,'click',()=>{const current:Theme=html.dataset.theme==='dark'?'dark':'light';const next:Theme=current==='dark'?'light':'dark';try{storage?.setItem(THEME_KEY,next);}catch{}paintTheme(next);root.dispatchEvent(new CustomEvent('hafize:theme-changed',{detail:{theme:next}}));}));
 const onMediaChange=()=>{if(!storage?.getItem(THEME_KEY))paintTheme(resolveTheme(null,media.matches));};
 disposers.push(addListener(media,'change',onMediaChange as EventListener));
 const monthLabel=documentRef.querySelector<HTMLElement>('#calendarMonth'),calendarGrid=documentRef.querySelector<HTMLElement>('#calendarGrid');
 monthLabel?.setAttribute('aria-live','polite');calendarGrid?.setAttribute('aria-label','Takvim günleri');
 let cursor=new Date(),selectedDay=cursor.getDate();
 const desktop=root.matchMedia(DESKTOP_AGENDA_MEDIA),agenda=documentRef.querySelector<HTMLElement>('#desktopAgenda');
 const agendaTitle=documentRef.querySelector<HTMLElement>('#desktopAgendaTitle'),agendaStatus=documentRef.querySelector<HTMLElement>('#desktopAgendaStatus'),agendaList=documentRef.querySelector<HTMLElement>('#desktopAgendaList');
 const clock=documentRef.querySelector<HTMLElement>('#desktopAgendaClock'),dateLabel=documentRef.querySelector<HTMLElement>('#desktopAgendaDate');
 const main=documentRef.querySelector<HTMLElement>('.main');
 const desktopActive=()=>Boolean(agenda&&desktop.matches&&main&&(!main.dataset.workspace||main.dataset.workspace==='chat')&&!documentRef.hidden);
 let agendaRows:DesktopAgendaTask[]=[],agendaState:'idle'|'loading'|'ready'|'error'|'auth'='idle',partialAgenda=false,agendaAbort:AbortController|null=null;
 const formatDay=new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long'}),formatTime=new Intl.DateTimeFormat('tr-TR',{hour:'2-digit',minute:'2-digit'});
 const updateClock=()=>{if(!desktopActive())return;const date=new Date();if(clock)clock.textContent=formatTime.format(date);if(dateLabel)dateLabel.textContent=formatDay.format(date);};
 const renderAgenda=()=>{if(!desktopActive()||!agendaTitle||!agendaStatus||!agendaList)return;const date=new Date(cursor.getFullYear(),cursor.getMonth(),selectedDay);agendaTitle.textContent=formatDay.format(date);const rows=agendaTasksForDate(agendaRows,date);agendaList.replaceChildren();
 const labels:Record<string,string>={scheduled:'Planlandı',running:'Çalışıyor',completed:'Tamamlandı',failed:'Başarısız'};
 for(const row of rows){const li=documentRef.createElement('li'),time=documentRef.createElement('time'),text=documentRef.createElement('div'),title=documentRef.createElement('strong'),status=documentRef.createElement('small');time.dateTime=row.runAt;time.textContent=formatTime.format(new Date(row.runAt));title.textContent=row.title;status.textContent=labels[row.status]||row.status;text.append(title,status);li.append(time,text);agendaList.append(li);}
 agendaStatus.textContent=agendaState==='loading'?'Görevler yükleniyor…':agendaState==='auth'?'Görevleri görmek için oturum aç ve Yenile’ye bas.':agendaState==='error'?'Görevler alınamadı. Yeniden dene.':agendaState==='ready'?(rows.length?rows.length+' görev':partialAgenda?'Alınan görevler arasında bu güne ait kayıt yok.':'Bu gün için planlanmış görev yok.')+(partialAgenda?' · Kısmi liste; tümü Görevler bölümünde.':''):'Planlanmış Hafize görevleri';};
 const renderCalendar=(options:{readonly focusSelected?:boolean}={})=>{
  if(!calendarGrid||!monthLabel)return;
  monthLabel.textContent=new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(cursor);
  const cells=createMonthCells(cursor.getFullYear(),cursor.getMonth(),selectedDay);
  calendarGrid.replaceChildren(...cells.map(cell=>{const button=documentRef.createElement('button');button.type='button';button.className=`calendar-day${cell.outside?' outside':''}${cell.selected?' selected':''}`;button.textContent=String(cell.day);button.tabIndex=cell.selected?0:-1;button.setAttribute('aria-label',`${cell.day} ${cell.month+1} ${cell.year}`);button.setAttribute('aria-pressed',String(cell.selected));
   const day=new Date(cell.year,cell.month,cell.day);if(calendarDateKey(day)===calendarDateKey(new Date()))button.setAttribute('aria-current','date');if(desktopActive()&&agendaTasksForDate(agendaRows,day).length)button.dataset.hasTasks='true';
   const selectCell=()=>{cursor=new Date(cell.year,cell.month,1);selectedDay=cell.day;renderCalendar({focusSelected:true});};button.addEventListener('click',selectCell);button.addEventListener('keydown',(event)=>{const target=moveCalendarDate(cell.year,cell.month,cell.day,event.key);if(!target)return;event.preventDefault();cursor=new Date(target.year,target.month,1);selectedDay=target.day;renderCalendar({focusSelected:true});});return button;}));
  renderAgenda();
  if(options.focusSelected)calendarGrid.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
 };
 const prev=documentRef.querySelector<HTMLButtonElement>('#calendarPrev'),next=documentRef.querySelector<HTMLButtonElement>('#calendarNext');
 if(prev)disposers.push(addListener(prev,'click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);selectedDay=1;renderCalendar({focusSelected:true});}));
 if(next)disposers.push(addListener(next,'click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);selectedDay=1;renderCalendar({focusSelected:true});}));
 const refreshAgenda=async()=>{
  if(!desktopActive()||agendaAbort)return;
  const controller=new AbortController();agendaAbort=controller;agendaState='loading';agendaRows=[];partialAgenda=false;renderCalendar();
  try{
   // Same-origin owner session only: background display must not open an auth dialog.
   const response=await root.fetch('/api/schedules?scope=all&limit=100',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
   if(controller.signal.aborted||!desktopActive())return;
   if(response.status===401||response.status===403){agendaState='auth';return;}
   if(!response.ok)throw Error('AGENDA_HTTP');
   const data=await response.json();
   if(controller.signal.aborted||!desktopActive())return;
   if(!Array.isArray(data?.schedules))throw Error('AGENDA_INVALID');
   agendaRows=parseDesktopAgendaTasks(data.schedules);partialAgenda=Boolean(data.listMeta?.nextCursor)||(Number.isFinite(data.listMeta?.total)&&data.listMeta.total>data.schedules.length)||data.schedules.length>=100;agendaState='ready';
  }catch{if(!controller.signal.aborted)agendaState='error';}
  finally{if(agendaAbort===controller){agendaAbort=null;if(desktopActive())renderCalendar();}}
 };
 const syncAgenda=()=>{if(!desktopActive()){agendaAbort?.abort();agendaAbort=null;agendaRows=[];agendaState='idle';agendaList?.replaceChildren();return;}updateClock();void refreshAgenda();};
 const today=documentRef.querySelector<HTMLButtonElement>('#desktopCalendarToday'),refresh=documentRef.querySelector<HTMLButtonElement>('#desktopAgendaRefresh'),tasks=documentRef.querySelector<HTMLButtonElement>('#desktopAgendaTasks');
 if(today)disposers.push(addListener(today,'click',()=>{cursor=new Date();selectedDay=cursor.getDate();renderCalendar({focusSelected:true});}));
 if(refresh)disposers.push(addListener(refresh,'click',()=>void refreshAgenda()));
 if(tasks)disposers.push(addListener(tasks,'click',()=>documentRef.querySelectorAll<HTMLButtonElement>('#sidebar .nav-item')[1]?.click()));
 if(agenda){disposers.push(addListener(desktop,'change',syncAgenda),addListener(root,'hafize:workspace-changed',syncAgenda),addListener(documentRef,'visibilitychange',syncAgenda));const timer=root.setInterval(updateClock,15000);disposers.push(()=>{root.clearInterval(timer);agendaAbort?.abort();agendaAbort=null;});}
 renderCalendar();syncAgenda();
 // The composer is fixed to the bottom of the window and grows with its text; publish the space it
 // covers so the chat can end above it instead of scrolling underneath.
 const composer=documentRef.querySelector<HTMLElement>('#composer');
 const SizeObserver=(root as typeof globalThis).ResizeObserver;
 if(composer){
  const stage=documentRef.querySelector<HTMLElement>('.chat-stage');
  const field=documentRef.querySelector<HTMLTextAreaElement>('#messageInput');
  const viewport=root.visualViewport;
  const mobile=root.matchMedia('(max-width: 680px) and (pointer: coarse)');
  let frame=0;
  const update=()=>{
   frame=0;
   const layoutHeight=html.clientHeight||root.innerHeight;
   const geometry=mobileKeyboardGeometry(layoutHeight,viewport?.height??layoutHeight,viewport?.offsetTop??0,mobile.matches&&documentRef.activeElement===field,viewport?.scale??1);
   html.dataset.hafizeKeyboard=geometry.active?'open':'closed';
   html.style.setProperty('--keyboard-bottom',geometry.bottom+'px');
   const bounds=composer.getBoundingClientRect();
   if(bounds.height<=0)return;
   // Use the actual fixed composer geometry instead of a forced 320px minimum.
   html.style.setProperty('--composer-space',Math.ceil(bounds.height+12)+'px');
   if(stage){
    const stageTop=stage.getBoundingClientRect().top;
    const height=Math.floor(bounds.top-stageTop-8);
    if(height>0)html.style.setProperty('--chat-stage-height',height+'px');
    else html.style.removeProperty('--chat-stage-height');
   }
  };
  const schedule=()=>{if(!frame)frame=root.requestAnimationFrame(update);};
  const sizeObserver=typeof SizeObserver==='function'?new SizeObserver(schedule):null;sizeObserver?.observe(composer);
  disposers.push(()=>{sizeObserver?.disconnect();if(frame)root.cancelAnimationFrame(frame);html.removeAttribute('data-hafize-keyboard');html.style.removeProperty('--keyboard-bottom');},addListener(root,'resize',schedule),addListener(root,'hafize:layout-changed',schedule),addListener(root,'hafize:workspace-changed',schedule));
  if(viewport)disposers.push(addListener(viewport,'resize',schedule),addListener(viewport,'scroll',schedule));
  if(field)disposers.push(addListener(field,'focus',schedule),addListener(field,'blur',schedule));
  update();
 }
 const mic=documentRef.querySelector<HTMLButtonElement>('#micBtn'),proxy=documentRef.querySelector<HTMLButtonElement>('#voiceProxy'),voiceCard=documentRef.querySelector<HTMLElement>('.voice-card');
 if(proxy)disposers.push(addListener(proxy,'click',()=>mic?.click()));
 const Observer=root.MutationObserver;
 const observer=mic&&Observer?new Observer(()=>{const active=mic.getAttribute('aria-pressed')==='true';voiceCard?.classList.toggle('listening',active);if(proxy)proxy.textContent=active?'Dinlemeyi durdur':'Dinlemek için dokun';}):null;
 if(observer&&mic)observer.observe(mic,{attributes:true,attributeFilter:['aria-pressed']});
 return Object.freeze({getTheme:()=>theme,renderCalendar,sidebarDisclosure,destroy(){observer?.disconnect();for(const dispose of disposers.splice(0))dispose();}});
}
const api=Object.freeze({THEME_KEY,LAYOUT_KEY,WEEKDAYS,resolveTheme,resolveUiLayout,installLayoutMode,createMonthCells,moveCalendarDate,installSidebarDisclosure,installChatAccessibility,install});
(globalThis as typeof globalThis & {HafizeUiShell?:unknown}).HafizeUiShell=api;
const start=()=>install(document,globalThis);
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
