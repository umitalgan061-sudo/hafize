import assert from 'node:assert/strict';
import { normalizeItem, extractVariables, LIMITS } from '../public/prompt-library.js';

const items = [
  { title: 'Metin editörü', body: 'Metni {{baglam}} bağlamında düzenle: {{metin}}', tags: ['yazma', 'düzenleme'] },
  { title: 'Kısa özet', body: 'Özetle: {{icerik}} / {{uzunluk}}', tags: ['özet'] },
  { title: 'Kod incelemesi', body: 'Kod {{dil}}: {{kod}}', tags: ['kod'] },
  { title: 'Toplantı notu', body: 'Notlar: {{notlar}}', tags: ['iş'] },
  { title: 'Araştırma çerçevesi', body: 'Konu: {{konu}}', tags: ['araştırma'] },
  { title: 'Planlayıcı', body: 'Hedef {{hedef}}, süre {{sure}}', tags: ['planlama'] },
  { title: 'Karar matrisi', body: 'Kriter {{kriterler}}, seçenekler {{secenekler}}', tags: ['karar'] },
  { title: 'E-posta taslağı', body: 'Amaç {{amac}}, ton {{ton}}, alıcı {{alici}}', tags: ['e-posta'] },
  { title: 'Test senaryoları', body: 'Özellik {{ozellik}}', tags: ['test'] },
  { title: 'Fikirden gereksinime', body: 'Fikir {{fikir}}', tags: ['ürün'] }
];
assert.equal(items.length, 10);
for (const item of items) {
  const normalized = normalizeItem(item);
  assert.ok(normalized);
  assert.ok(normalized.title.length <= LIMITS.MAX_TITLE);
  assert.deepEqual(normalized.variables, extractVariables(item.body));
  assert.ok(normalized.tags.length <= LIMITS.MAX_TAGS);
}
console.log('test-prompt-library-starters: ok');
