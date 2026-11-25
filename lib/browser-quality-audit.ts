/** Fixed, read-only browser diagnostics: no arbitrary script or interaction from tool arguments. */
export function browserViewport(value:unknown){
 if(value==='mobile')return {width:390,height:844,mobile:true};
 if(value==='tablet')return {width:820,height:1180,mobile:true};
 return {width:1280,height:900,mobile:false};
}
export function browserAuditExpression(){
 return `(() => {
 const d=document, root=d.documentElement, body=d.body;
 const visible=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
 const elements=s=>Array.from(d.querySelectorAll(s)).filter(visible);
 const named=e=>Boolean((e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.getAttribute('title')||e.textContent||'').trim());
 const inputs=elements('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]),select,textarea');
 const imgs=elements('img');
 const buttons=elements('button,[role=button],input[type=button],input[type=submit]');
 const links=elements('a[href]');
 const vw=root.clientWidth||innerWidth;
 const scroll=Math.max(root.scrollWidth,body?.scrollWidth||0);
 const nav=performance.getEntriesByType('navigation')[0];
 return {viewportWidth:vw,viewportHeight:root.clientHeight||innerHeight,horizontalOverflowPx:Math.max(0,scroll-vw),documentReadyState:d.readyState,
   headingCount:elements('h1').length,landmarkCount:elements('main,[role=main]').length,languagePresent:!!root.lang,
   visibleInputs:inputs.length,possiblyUnlabelledInputs:inputs.filter(e=>!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.labels?.length&&!e.title).length,
   visibleButtons:buttons.length,possiblyUnnamedButtons:buttons.filter(e=>!named(e)&&!(e.tagName==='INPUT'&&e.value)).length,
   visibleLinks:links.length,possiblyUnnamedLinks:links.filter(e=>!named(e)&&!e.querySelector('img[alt]:not([alt=""])')).length,
   visibleImages:imgs.length,brokenImages:imgs.filter(e=>e.complete&&e.naturalWidth===0&&!!e.currentSrc).length,missingAltAttributes:imgs.filter(e=>!e.hasAttribute('alt')).length,
   loadEventMs:nav&&Number.isFinite(nav.loadEventEnd)?Math.round(nav.loadEventEnd):null};
 })()`;
}
