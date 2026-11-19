import {calculationFor} from '../../lib/chat-calculation.ts';
import {withCalculation} from './chat-calculation-bridge.ts';
window.fetch=withCalculation(window.fetch.bind(window));
import { suggestTools } from '../../lib/composer-tool-suggestions.ts';
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

function attachToolSuggestions() {
  const box=document.querySelector<HTMLTextAreaElement>('#messageInput');
  const form=box?.closest('form') ?? document.querySelector('#composer');
  if(!box || !form || document.querySelector('#local-tool-suggestions')) return;
  const panel=document.createElement('nav');
  panel.id='local-tool-suggestions';
  panel.setAttribute('aria-label','İsteğe uygun araçlar');
  form.before(panel);
  function refresh() {
    panel.replaceChildren();
    const matches=suggestTools(box!.value);
    const arithmetic=calculationFor(box!.value);
    panel.hidden=!matches.length && !arithmetic;
    if(arithmetic){const result=document.createElement('output'); result.textContent='Yerel hesap: '+arithmetic; panel.append(result);}
    for(const match of matches) {
      const link=document.createElement('a');
      link.className='soft-btn';link.href=match.url;link.target='_blank';link.rel='noopener';
      link.textContent=match.title;panel.append(link);
    }
  }
  box.addEventListener('input',refresh);
  refresh();
}
attachToolSuggestions();
