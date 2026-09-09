import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const policy = require('../public/sw-policy.js');
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const ORIGIN = 'https://hafize.example';

// Shell cache sözleşmesi: listedeki her yol gerçekten dağıtılan bir dosya olmalıdır.
// Eksik bir dosya `cache.addAll()` çağrısını komple reddeder ve install'ı sessizce bozar.
for (const asset of policy.SHELL_ASSETS) {
  if (asset === '/') continue;
  assert.equal(
    existsSync(new URL(`.${asset}`, `file://${PUBLIC_DIR}`)),
    true,
    `${asset} shell listesinde var ama public/ altında yok`
  );
}

// index.html'in yüklediği her same-origin alt kaynak offline shell'de bulunmalıdır;
// aksi hâlde cache'den açılan sayfa eksik script/stil ile çalışır.
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const referenced = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value) => value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/api/'));
assert.ok(referenced.length > 0, 'index.html alt kaynak referansı bulunamadı');
for (const asset of new Set(referenced)) {
  assert.equal(
    policy.SHELL_ASSETS.includes(asset),
    true,
    `${asset} index.html tarafından yükleniyor ama shell cache listesinde yok`
  );
}

// Sınıflandırma listeyle tutarlı olmalı: shell yolları shell, bilinmeyen statikler network-only.
for (const asset of policy.SHELL_ASSETS) {
  assert.equal(
    policy.classifyRequest({ url: new URL(asset, ORIGIN).href, method: 'GET', mode: 'same-origin', headers: {} }, ORIGIN),
    'shell',
    `${asset} shell olarak sınıflanmalı`
  );
}
assert.equal(
  policy.classifyRequest({ url: `${ORIGIN}/sw.js`, method: 'GET', mode: 'same-origin', headers: {} }, ORIGIN),
  'network-only',
  'service worker dosyası cache üzerinden sunulmamalı'
);

// Sürüm sabiti değil biçim doğrulanır; yeni asset turunda yalnız sw-policy.js güncellenir.
assert.match(policy.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(policy.shouldDeleteCache(policy.CURRENT_CACHE), false);

console.log('PWA shell manifest OK: liste-disk tutarlılığı, index.html kapsaması ve sürüm biçimi');
