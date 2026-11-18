const byId = id => document.getElementById(id);
const scenes = byId('scenes');
const synth = window.speechSynthesis;
const status = message => { byId('status').textContent = message; };
let generation = 0;

function addScene() {
  const previous = scenes.lastElementChild;
  const start = Number(previous?.querySelectorAll('input')[1].value || 0);
  const row = byId('scene').content.firstElementChild.cloneNode(true);
  const [from, to] = row.querySelectorAll('input');
  from.value = start;
  to.value = start + 5;
  scenes.append(row);
  row.querySelector('button').onclick = () => { stop(); row.remove(); numberScenes(); };
  numberScenes();
  row.querySelector('textarea').focus();
}

function numberScenes() {
  [...scenes.children].forEach((row, i) => { row.querySelector('legend').textContent = 'Sahne ' + (i + 1); });
}

function timeline() {
  let last = 0;
  if (!scenes.children.length) throw Error('En az bir sahne ekle.');
  return [...scenes.children].map((row, i) => {
    const [from, to] = [...row.querySelectorAll('input')].map(input => Math.round(input.valueAsNumber * 1000));
    const text = row.querySelector('textarea').value.trim();
    if (!text || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < last || to <= from)
      throw Error('Sahne ' + (i + 1) + ' için metni ve zaman aralığını kontrol et. Sahneler çakışamaz.');
    last = to;
    return { from, to, text };
  });
}

function timestamp(ms, decimal) {
  const pad = n => String(n).padStart(2, '0');
  return pad(Math.floor(ms / 3600000)) + ':' + pad(Math.floor(ms / 60000) % 60) + ':' +
    pad(Math.floor(ms / 1000) % 60) + decimal + String(ms % 1000).padStart(3, '0');
}

function download(ext) {
  const vtt = ext === 'vtt';
  const decimal = vtt ? '.' : ',';
  const cues = timeline().map(({from, to, text}, index) => {
    let caption = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]*\n+/g, '\n');
    if (vtt) caption = caption.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    return [String(index + 1), timestamp(from, decimal) + ' --> ' + timestamp(to, decimal), caption].join('\n');
  });
  const blob = new Blob([(vtt ? 'WEBVTT\n\n' : '') + cues.join('\n\n') + '\n'], {type:vtt ? 'text/vtt;charset=utf-8' : 'application/x-subrip'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'hafize-altyazi.' + ext;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  status(link.download + ' hazır.');
}

function stop() {
  generation++;
  synth?.cancel();
}
function read() {
  const entries = timeline();
  stop();
  const token = generation;
  const voice = synth.getVoices().find(v => v.voiceURI === byId('voice').value);
  function next(i) {
    if (token !== generation) return;
    if (i === entries.length) { status('Seslendirme tamamlandı.'); return; }
    const utterance = new SpeechSynthesisUtterance(entries[i].text);
    utterance.lang = voice?.lang || 'tr-TR';
    if (voice) utterance.voice = voice;
    utterance.rate = Number(byId('rate').value);
    utterance.onend = () => next(i + 1);
    utterance.onerror = () => { if (token === generation) status('Cihaz bu sesi oynatamadı.'); };
    status('Sahne ' + (i + 1) + ' okunuyor.');
    synth.speak(utterance);
  }
  next(0);
}
function refreshVoices() {
  const menu = byId('voice');
  const selected = menu.value;
  menu.replaceChildren(new Option('Cihaz varsayılanı', ''));
  for (const voice of synth.getVoices()) menu.add(new Option(voice.name + ' · ' + voice.lang, voice.voiceURI));
  menu.value = [...menu.options].some(option => option.value === selected) ? selected : '';
}
const guarded = action => () => { try { action(); } catch (err) { status(err.message); } };
byId('add').onclick = addScene;
byId('srt').onclick = guarded(() => download('srt'));
byId('vtt').onclick = guarded(() => download('vtt'));
byId('read').onclick = guarded(read);
byId('stop').onclick = () => { stop(); status('Durduruldu.'); };
if (synth) {
  refreshVoices();
  synth.addEventListener('voiceschanged', refreshVoices);
  window.addEventListener('pagehide', stop);
} else {
  byId('read').disabled = byId('stop').disabled = true;
  status('Bu tarayıcı seslendirmeyi desteklemiyor. Altyazı dışa aktarımı kullanılabilir.');
}
addScene();
