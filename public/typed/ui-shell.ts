export type Theme = 'light' | 'dark';
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
 let open=sidebar.classList.contains('open');
 const render=(next:boolean,focusToggle=false)=>{open=Boolean(next);sidebar.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-controls',sidebar.id||'sidebar');toggle.setAttribute('aria-label',open?'Menüyü kapat':'Menüyü aç');if(focusToggle)toggle.focus();};
 const onToggle=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();render(!open);};
 const onKeydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&open){event.preventDefault();render(false,true);}};
 toggle.addEventListener('click',onToggle,true);documentRef.addEventListener('keydown',onKeydown);render(open);
 return Object.freeze({isOpen:()=>open,close:()=>render(false),destroy(){toggle.removeEventListener('click',onToggle,true);documentRef.removeEventListener('keydown',onKeydown);}});
}
export function installChatAccessibility(documentRef:Document):boolean{
 const stage=documentRef.querySelector<HTMLElement>('.chat-stage'),messages=documentRef.querySelector<HTMLElement>('#messages');if(!messages)return false;
 stage?.removeAttribute('aria-live');messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');messages.setAttribute('aria-relevant','additions text');messages.setAttribute('aria-atomic','false');messages.setAttribute('aria-label','Sohbet mesajları');return true;
}
export function install(documentRef:Document,root:Window&typeof globalThis):UiShellController|null{
 const html=documentRef.documentElement;if(!html)return null;
 const disposers:(()=>void)[]=[];const sidebarDisclosure=installSidebarDisclosure(documentRef);if(sidebarDisclosure)disposers.push(sidebarDisclosure.destroy);
 installChatAccessibility(documentRef);
 const storage=root.localStorage,media=root.matchMedia('(prefers-color-scheme: dark)');
 let theme=resolveTheme(storage?.getItem(THEME_KEY),Boolean(media.matches));
 const themeToggle=documentRef.querySelector<HTMLButtonElement>('#themeToggle');
 const paintTheme=(next:Theme)=>{theme=next;html.dataset.theme=next;themeToggle?.setAttribute('aria-pressed',String(next==='dark'));themeToggle?.setAttribute('title',next==='dark'?'Gündüz moduna geç':'Gece moduna geç');documentRef.querySelector('meta[name="theme-color"]')?.setAttribute('content',next==='dark'?'#202122':'#f7f5f0');};
 paintTheme(theme);
 if(themeToggle)disposers.push(addListener(themeToggle,'click',()=>{const next:Theme=theme==='dark'?'light':'dark';try{storage?.setItem(THEME_KEY,next);}catch{}paintTheme(next);}));
 const onMediaChange=()=>{if(!storage?.getItem(THEME_KEY))paintTheme(resolveTheme(null,media.matches));};
 disposers.push(addListener(media,'change',onMediaChange as EventListener));
 const monthLabel=documentRef.querySelector<HTMLElement>('#calendarMonth'),calendarGrid=documentRef.querySelector<HTMLElement>('#calendarGrid');
 monthLabel?.setAttribute('aria-live','polite');calendarGrid?.setAttribute('aria-label','Takvim günleri');
 let cursor=new Date(),selectedDay=cursor.getDate();
 const renderCalendar=(options:{readonly focusSelected?:boolean}={})=>{
  if(!calendarGrid||!monthLabel)return;
  monthLabel.textContent=new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(cursor);
  const cells=createMonthCells(cursor.getFullYear(),cursor.getMonth(),selectedDay);
  calendarGrid.replaceChildren(...cells.map(cell=>{const button=documentRef.createElement('button');button.type='button';button.className=`calendar-day${cell.outside?' outside':''}${cell.selected?' selected':''}`;button.textContent=String(cell.day);button.tabIndex=cell.selected?0:-1;button.setAttribute('aria-label',`${cell.day} ${cell.month+1} ${cell.year}`);button.setAttribute('aria-pressed',String(cell.selected));
   const selectCell=()=>{cursor=new Date(cell.year,cell.month,1);selectedDay=cell.day;renderCalendar({focusSelected:true});};button.addEventListener('click',selectCell);button.addEventListener('keydown',(event)=>{const target=moveCalendarDate(cell.year,cell.month,cell.day,event.key);if(!target)return;event.preventDefault();cursor=new Date(target.year,target.month,1);selectedDay=target.day;renderCalendar({focusSelected:true});});return button;}));
  if(options.focusSelected)calendarGrid.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
 };
 const prev=documentRef.querySelector<HTMLButtonElement>('#calendarPrev'),next=documentRef.querySelector<HTMLButtonElement>('#calendarNext');
 if(prev)disposers.push(addListener(prev,'click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);selectedDay=1;renderCalendar({focusSelected:true});}));
 if(next)disposers.push(addListener(next,'click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);selectedDay=1;renderCalendar({focusSelected:true});}));
 renderCalendar();
 const mic=documentRef.querySelector<HTMLButtonElement>('#micBtn'),proxy=documentRef.querySelector<HTMLButtonElement>('#voiceProxy'),voiceCard=documentRef.querySelector<HTMLElement>('.voice-card');
 if(proxy)disposers.push(addListener(proxy,'click',()=>mic?.click()));
 const Observer=root.MutationObserver;
 const observer=mic&&Observer?new Observer(()=>{const active=mic.getAttribute('aria-pressed')==='true';voiceCard?.classList.toggle('listening',active);if(proxy)proxy.textContent=active?'Dinlemeyi durdur':'Dinlemek için dokun';}):null;
 if(observer&&mic)observer.observe(mic,{attributes:true,attributeFilter:['aria-pressed']});
 return Object.freeze({getTheme:()=>theme,renderCalendar,sidebarDisclosure,destroy(){observer?.disconnect();for(const dispose of disposers.splice(0))dispose();}});
}
const api=Object.freeze({THEME_KEY,WEEKDAYS,resolveTheme,createMonthCells,moveCalendarDate,installSidebarDisclosure,installChatAccessibility,install});
(globalThis as typeof globalThis & {HafizeUiShell?:unknown}).HafizeUiShell=api;
const start=()=>install(document,globalThis);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
