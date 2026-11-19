function transfer() {
  if(location.hash!=='#dosya-analizi')return;
  const box=document.querySelector<HTMLTextAreaElement>('#messageInput');
  if(!box)return;
  try {
    const draft=sessionStorage.getItem('hafize.analysis.draft');
    if(!draft)return;
    box.value=(box.value ? box.value+'\n\n' : '')+draft;
    box.dispatchEvent(new Event('input',{bubbles:true}));
    sessionStorage.removeItem('hafize.analysis.draft');
    history.replaceState(null,'',location.pathname+location.search);
    box.focus();
  }catch{/* Storage may be unavailable in private sessions. */}
}
if(document.readyState==='complete')transfer();else window.addEventListener('load',transfer,{once:true});
