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
/** The layout and visual viewport differ while an iOS software keyboard is open. */
export function composerViewportGeometry(layoutHeight:number,viewportHeight:number,offsetTop:number,focused:boolean,mobile:boolean,scale=1){
 const valid=[layoutHeight,viewportHeight,offsetTop,scale].every(Number.isFinite);
 if(!valid||!focused||!mobile||scale>1.05||scale<0.95||layoutHeight<=0||viewportHeight<=0)return {active:false,bottom:0,top:0};
 const top=Math.max(0,Math.round(offsetTop));
 const bottom=Math.max(0,Math.round(layoutHeight-viewportHeight-top));
 const active=layoutHeight-viewportHeight>=100;
 return {active,bottom:active?bottom:0,top:active?top:0};
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
 // The composer is fixed to the bottom of the window and grows with its text; publish the space it
 // covers so the chat can end above it instead of scrolling underneath.
 const composer=documentRef.querySelector<HTMLElement>('#composer');
 const SizeObserver=(root as typeof globalThis).ResizeObserver;
 if(composer&&typeof SizeObserver==='function'){
  // The chat scrolls inside .chat-stage; its height ends exactly at the composer's top edge so the
  // last message is never hidden behind the fixed composer, whatever the composer's height.
  const stage=documentRef.querySelector<HTMLElement>('.chat-stage');
  const input=documentRef.querySelector<HTMLTextAreaElement>('#messageInput');
  const viewport=root.visualViewport;
  const applyComposerSpace=()=>{
   const geometry=composerViewportGeometry(root.innerHeight,viewport?.height??root.innerHeight,viewport?.offsetTop??0,documentRef.activeElement===input,root.innerWidth<=680,viewport?.scale??1);
   if(geometry.active){html.dataset.composerKeyboard='true';html.style.setProperty('--composer-keyboard-inset',geometry.bottom+'px');html.style.setProperty('--composer-viewport-top',geometry.top+'px');}
   else{delete html.dataset.composerKeyboard;html.style.removeProperty('--composer-keyboard-inset');html.style.removeProperty('--composer-viewport-top');}
   const box=composer.getBoundingClientRect();if(!box.height)return;
   html.style.setProperty('--composer-space',Math.ceil(box.height+20)+'px');
   if(stage){const stageTop=stage.getBoundingClientRect().top;if(box.top>stageTop)html.style.setProperty('--chat-stage-height',Math.max(48,Math.floor(box.top-stageTop-8))+'px');}
  };
  let frame=0;
  const schedule=()=>{if(frame)return;frame=root.requestAnimationFrame(()=>{frame=0;applyComposerSpace();});};
  const sizeObserver=new SizeObserver(schedule);sizeObserver.observe(composer);
  disposers.push(()=>{sizeObserver.disconnect();if(frame)root.cancelAnimationFrame(frame);delete html.dataset.composerKeyboard;html.style.removeProperty('--composer-keyboard-inset');html.style.removeProperty('--composer-viewport-top');},addListener(root,'resize',schedule),addListener(root,'hafize:layout-changed',schedule),addListener(root,'hafize:workspace-changed',schedule));
  if(viewport)disposers.push(addListener(viewport,'resize',schedule),addListener(viewport,'scroll',schedule));
  if(input)disposers.push(addListener(input,'focus',schedule),addListener(input,'blur',schedule));
  applyComposerSpace();
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
