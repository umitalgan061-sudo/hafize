import assert from 'node:assert/strict';
function label(items, query) {
  if (!items.length) return 'Henüz gönderilmiş bir mesaj yok.';
  const visible = items.filter((item) => !query || item.includes(query));
  return visible.length ? `${visible.length} kayıt` : 'Arama sonucu yok.';
}
assert.equal(label([], ''), 'Henüz gönderilmiş bir mesaj yok.');
assert.equal(label(['a'], 'z'), 'Arama sonucu yok.');
assert.equal(label(['a'], ''), '1 kayıt');
console.log('composer history empty states: ok');
