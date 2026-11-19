// Keep the selection local until the user explicitly adds it to the composer.
export function enableMessageQuotes() {
  const messages=document.querySelector('#messages');
  const box=document.querySelector<HTMLTextAreaElement>('#messageInput');
  const form=box?.closest('form')??document.querySelector('#composer');
  if(!messages||!box||!form)return;
  const button=document.createElement('button');
  button.type='button';button.className='soft-btn';button.hidden=true;
  button.id='quote-chat-selection';button.textContent='Seçili metni sohbette alıntıla';
  form.before(button);
  let excerpt='', origin:Element|null=null;
  function refresh() {
    const selection=window.getSelection();
    if(document.activeElement===button && !selection?.toString().trim())return;
    const node=selection?.anchorNode, end=selection?.focusNode;
    const element=node instanceof Element ? node : node?.parentElement;
    const content=element?.closest('.message .content');
    const text=selection?.toString().trim()??'';
    origin=content && messages!.contains(content) && end && content.contains(end) && text.length<=16000 ? content : null;
    excerpt=origin ? text : '';
    button.hidden=!excerpt;
  }
  document.addEventListener('selectionchange',refresh);
  button.addEventListener('mousedown',event=>event.preventDefault());
  button.onclick=()=>{
    if(!excerpt || !origin || !messages.contains(origin))return;
    const quote=excerpt.split(/\r?\n/).map(line=>'> '+line).join('\n');
    const label=origin.closest('.message.user')?'Önceki kullanıcı mesajından alıntı':'Önceki yanıttan alıntı';
    box.value=(box.value?box.value+'\n\n':'')+label+'\n'+quote+'\n\n';
    excerpt='';origin=null;button.hidden=true;window.getSelection()?.removeAllRanges();
    box.dispatchEvent(new Event('input',{bubbles:true}));box.focus();
    box.setSelectionRange(box.value.length,box.value.length);
  };
}
