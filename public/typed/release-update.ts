// Release checks never clear localStorage, cookies, IndexedDB or conversations.
(() => {
  const loaded=document.querySelector<HTMLMetaElement>('meta[name="hafize-release"]')?.content||'';
  const valid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
  let busy=false,latest='',checked=0;
  const publish=()=>window.dispatchEvent(new CustomEvent('hafize:release-status',{detail:{loaded:valid(loaded)?loaded:null,latest:valid(latest)?latest:null,update:valid(loaded)&&valid(latest)&&loaded!==latest}}));
  const refresh=async(force=false)=>{
    if(busy||(!force&&Date.now()-checked<60000))return;busy=true;checked=Date.now();
    try{
      const res=await fetch('/release.json?check='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});
      const data=await res.json();if(!res.ok||!valid(data.commit))return;latest=data.commit;
      if(valid(latest)&&loaded!==latest){
        let banner=document.getElementById('hafizeReleaseNotice');
        if(!banner){banner=document.createElement('div');banner.id='hafizeReleaseNotice';banner.className='hafize-release-notice';banner.setAttribute('role','status');const label=document.createElement('span');label.textContent='Yeni Hafize sürümü hazır ('+latest.slice(0,7)+').';const button=document.createElement('button');button.type='button';button.textContent='Güncelle ve aç';button.addEventListener('click',()=>{button.disabled=true;const url=new URL(location.href);url.searchParams.set('release',latest);location.replace(url.href);});banner.append(label,button);document.body.append(banner);}
      }
    }catch{}finally{busy=false;publish();}
  };
  Object.assign(window,{HafizeRelease:Object.freeze({loaded:valid(loaded)?loaded:null,check:()=>refresh(true),state:()=>({loaded:valid(loaded)?loaded:null,latest:valid(latest)?latest:null})})});
  const start=()=>{void refresh(true);window.addEventListener('focus',()=>void refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});window.setInterval(()=>{if(!document.hidden)void refresh();},60000);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
