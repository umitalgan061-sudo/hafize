// Advanced workspace: presentation only. Existing cards retain their nodes, listeners,
// access controls, hidden state and API calls. Never move or clone a live feature.
export const ADVANCED_CATEGORIES = [
  ['all','Tümü'], ['daily','Günlük'], ['chat','Sohbet'], ['tasks','Görev'],
  ['connections','Bağlantı'], ['system','Sistem'], ['other','Diğer']
] as const;
export type AdvancedCategory = typeof ADVANCED_CATEGORIES[number][0];

export function normalizeAdvancedSearch(value:string):string {
  return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').trim();
}
export function classifyAdvancedCard(id:string, classes:string, title:string):AdvancedCategory {
  const key=normalizeAdvancedSearch(id+' '+classes+' '+title);
  if(/github|connect|baglanti|gmail|canva|notion|slack|figma|linear|browserbridge/.test(key))return 'connections';
  if(/calendar|voice-card|takvim|sesli asistan|agenda/.test(key))return 'daily';
  if(/schedule|task|gorev|planlan/.test(key))return 'tasks';
  if(/prompt|conversation|messageworkspace|message-workspace|history|sohbet|istem|mesaj/.test(key))return 'chat';
  if(/system|readiness|runtime|model|agent|sistem|durum|hafiza|backup|privacy/.test(key))return 'system';
  return 'other';
}
export function advancedCardMatches(category:AdvancedCategory, query:string, cardCategory:AdvancedCategory, label:string):boolean {
  return (category==='all'||category===cardCategory)&&normalizeAdvancedSearch(label).includes(normalizeAdvancedSearch(query));
}

export function installAdvancedWorkspace(doc:Document, root:Window&typeof globalThis):()=>void {
  const main=doc.querySelector<HTMLElement>('.main');
  const rail=doc.querySelector<HTMLElement>('.utility-rail');
  const top=doc.querySelector<HTMLElement>('.topbar');
  const composer=doc.querySelector<HTMLElement>('#composer');
  if(!main||!rail||!top||doc.getElementById('advancedWorkspaceTools'))return ()=>{};
  const html=doc.documentElement;
  const wide=root.matchMedia('(min-width: 1180px)');
  let desktopOpen=true, mobileOpen=false;
  let category:AdvancedCategory='all';
  const button=(label:string,cls:string)=>{const b=doc.createElement('button');b.type='button';b.className=cls;b.textContent=label;return b;};
  const make=(tag:string,cls:string,label?:string)=>{const e=doc.createElement(tag);e.className=cls;if(label!==undefined)e.textContent=label;return e;};
  // Icon and words: phones show the icon alone (advanced-workspace.css), so the name is also the button's label.
  const toggle=button('','aw-top-toggle');
  const toggleLabel=make('span','aw-top-label','Araç merkezi');
  const toggleIcon=make('span','aw-top-icon');toggleIcon.setAttribute('aria-hidden','true');
  toggle.append(toggleIcon,toggleLabel);
  toggle.id='advancedWorkspaceTools';toggle.setAttribute('aria-expanded','false');
  const previousRailId=rail.id;
  if(!rail.id)rail.id='advancedWorkspaceRail';
  toggle.setAttribute('aria-controls',rail.id);
  top.insertBefore(toggle,top.querySelector('#themeToggle'));
  const bar=make('section','aw-rail-header');
  bar.id='advancedWorkspaceHeader';
  bar.setAttribute('aria-label','Gelişmiş araç merkezi');
  const heading=make('div','aw-heading');
  const titleBlock=make('div','aw-title-block');
  titleBlock.append(make('span','aw-eyebrow','ÇALIŞMA ALANI'),make('h2','aw-title','Araç merkezi'));
  const close=button('×','aw-close');close.setAttribute('aria-label','Araç merkezini kapat');
  heading.append(titleBlock,close);
  const description=make('p','aw-description','İhtiyacın olan aracı bul, sohbetten ayrılmadan kullan.');
  const shortcuts=make('div','aw-shortcuts');
  shortcuts.setAttribute('aria-label','Çalışma alanına git');
  const navButtons=[...doc.querySelectorAll<HTMLButtonElement>('.nav-list .nav-item')];
  for(const name of ['Görevler','Bağlantılar','Ayarlar']){
    const destination=navButtons.find(b=>normalizeAdvancedSearch(b.textContent||'').includes(normalizeAdvancedSearch(name)));
    if(!destination)continue;
    const shortcut=button(name,'aw-shortcut');
    shortcut.addEventListener('click',()=>{if(!destination.disabled)destination.click();});
    shortcuts.append(shortcut);
  }
  const search=doc.createElement('input');search.type='search';search.className='aw-search';search.placeholder='Araç ara…';search.setAttribute('aria-label','Araç merkezinde ara');search.autocomplete='off';
  const filters=make('div','aw-filters');filters.setAttribute('role','group');filters.setAttribute('aria-label','Araç kategorisi');
  const count=make('p','aw-count');count.setAttribute('role','status');
  const reset=button('Filtreyi temizle','aw-reset');reset.hidden=true;
  const filterButtons=new Map<AdvancedCategory,HTMLButtonElement>();
  const footer=make('div','aw-summary');footer.append(count,reset);
  bar.append(heading,description,shortcuts,search,filters,footer);
  rail.prepend(bar);

  // Keep layout changes separate from the app's navigation controller.
  const inChat=()=>!main.dataset.workspace||main.dataset.workspace==='chat';
  const active=()=>html.dataset.hafizeLayout==='classic'&&inChat();
  const isOpen=()=>wide.matches?desktopOpen:mobileOpen;
  // Focus follows the panel only when the user closes it; on load a hidden panel must not pull focus
  // (and a focus ring) onto the header button because a card inside it focused itself.
  let shownBefore=false;
  const syncLayout=()=>{
    const visible=active()&&isOpen();
    html.dataset.awReady='true';
    main.dataset.awRail=visible?'open':'closed';
    toggle.setAttribute('aria-expanded',String(visible));
    toggleLabel.textContent=visible?'Araçları gizle':'Araç merkezi';
    toggle.title=visible?'Araç merkezini kapat':'Araç merkezini aç';
    toggle.setAttribute('aria-label',toggle.title);
    if(!visible&&shownBefore&&rail.contains(doc.activeElement)&&active())toggle.focus();
    shownBefore=visible;
  };
  const notify=()=>root.dispatchEvent(new root.CustomEvent('hafize:layout-changed',{detail:{layout:html.dataset.hafizeLayout,source:'advanced-workspace'}}));
  const changeOpen=(next:boolean,focus=false)=>{
    // The phone panel covers the chat; put the keyboard away instead of leaving it over the panel.
    const typing=doc.activeElement as HTMLElement|null;
    if(next&&!wide.matches&&typing?.id==='messageInput'&&root.matchMedia('(pointer: coarse)').matches)typing.blur();
    if(wide.matches)desktopOpen=next;else mobileOpen=next;
    syncLayout();notify();
    if(focus){if(next)(wide.matches?search:close).focus();else toggle.focus();}
  };
  toggle.addEventListener('click',()=>changeOpen(!isOpen(),true));
  close.addEventListener('click',()=>changeOpen(false,true));
  const cards=()=>Array.from(rail.children).filter((n):n is HTMLElement=>n instanceof root.HTMLElement&&n!==bar&&n.classList.contains('utility-card'));
  const cardTitle=(card:HTMLElement)=>card.querySelector('.utility-head, h2, h3')?.textContent?.trim()||card.getAttribute('aria-label')||card.id;
  const applyFilters=()=>{
    if(!active())return;
    let total=0,shown=0;
    for(const card of cards()){
      const label=cardTitle(card);
      const group=classifyAdvancedCard(card.id,card.className,label);
      card.dataset.awCategory=group;
      const matches=advancedCardMatches(category,search.value,group,label+' '+card.id);
      card.toggleAttribute('data-aw-excluded',!matches);
      if(!card.hidden){total++;if(matches)shown++;}
    }
    for(const [key,b] of filterButtons)b.setAttribute('aria-pressed',String(key===category));
    count.textContent=shown===0?'Bu filtreye uygun araç bulunamadı.':shown+' / '+total+' araç';
    reset.hidden=category==='all'&&!search.value;
  };
  for(const [key,label] of ADVANCED_CATEGORIES){
    const b=button(label,'aw-filter');b.setAttribute('aria-pressed',String(key==='all'));
    b.addEventListener('click',()=>{category=key;applyFilters();});
    filterButtons.set(key,b);filters.append(b);
  }
  const clear=()=>{category='all';search.value='';applyFilters();};
  reset.addEventListener('click',clear);search.addEventListener('input',applyFilters);
  search.addEventListener('keydown',e=>{if(e.key==='Escape'&&search.value){e.stopPropagation();clear();}});
  const escape=(event:KeyboardEvent)=>{
    if(event.key==='Escape'&&active()&&isOpen()&&rail.contains(doc.activeElement)&&!event.defaultPrevented&&!doc.querySelector('dialog[open], .approval-backdrop')){
      event.preventDefault();changeOpen(false,true);
    }
  };
  doc.addEventListener('keydown',escape);
  const layoutChanged=()=>{if(!active())mobileOpen=false;syncLayout();applyFilters();};
  const viewportChanged=()=>{mobileOpen=false;syncLayout();notify();};
  root.addEventListener('hafize:layout-changed',layoutChanged);
  root.addEventListener('hafize:workspace-changed',layoutChanged);
  wide.addEventListener('change',viewportChanged);
  // Only direct card changes and hidden-state changes matter. Do not observe text streaming,
  // timers or other subtree activity, and never make an API request to calculate counts.
  const observer=new root.MutationObserver(()=>{layoutChanged();observeCards();});
  const observeCards=()=>{
    observer.disconnect();
    observer.observe(main,{attributes:true,attributeFilter:['data-workspace']});
    observer.observe(html,{attributes:true,attributeFilter:['data-hafize-layout']});
    observer.observe(rail,{childList:true});
    for(const card of cards())observer.observe(card,{attributes:true,attributeFilter:['hidden']});
  };
  observeCards();layoutChanged();
  const measureTop=()=>html.style.setProperty('--aw-top',Math.ceil(top.getBoundingClientRect().height)+'px');
  const topObserver=typeof root.ResizeObserver==='function'?new root.ResizeObserver(measureTop):null;
  topObserver?.observe(top);measureTop();
  // The existing composer stays in place; the CSS adjusts its geometry with the rail.
  composer?.setAttribute('data-aw-composer','true');
  return ()=>{
    topObserver?.disconnect();html.style.removeProperty('--aw-top');
    observer.disconnect();wide.removeEventListener('change',viewportChanged);
    root.removeEventListener('hafize:layout-changed',layoutChanged);
    root.removeEventListener('hafize:workspace-changed',layoutChanged);
    doc.removeEventListener('keydown',escape);
    for(const card of cards()){delete card.dataset.awCategory;card.removeAttribute('data-aw-excluded');}
    delete html.dataset.awReady;delete main.dataset.awRail;
    composer?.removeAttribute('data-aw-composer');toggle.remove();bar.remove();rail.id=previousRailId;
  };
}
