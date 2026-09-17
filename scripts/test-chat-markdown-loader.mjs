// Markdown katmanı sayfaya nasıl giriyor?
//
// Katman üç varlıktan oluşur ve sırası bağlayıcıdır: biçem, sonra saf
// ayrıştırıcı, sonra ayrıştırıcıyı global üzerinden bulan sohbet köprüsü.
// `chat-markdown.js` yüklenirken `window.HafizeMarkdown`'ı okur, bu yüzden
// `markdown-renderer.js`'ten sonra gelmek zorundadır.
//
// Üçü de `index.html` içinde doğrudan etiketlenir. Bu paketin asıl işi, bir
// başka modülün aynı üç varlığı **ikinci kez** dinamik olarak enjekte
// etmediğini doğrulamaktır: iki kopya ayrıştırıcı, ikinci kez çalışan bir UMD
// sarmalayıcı ve yarışan iki `paint()` yolu demektir.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ASSETS = Object.freeze({
  style: '/chat-markdown.css',
  renderer: '/markdown-renderer.js',
  chat: '/chat-markdown.js'
});

const html = fs.readFileSync('public/index.html', 'utf8');

// --- Her varlık sayfada tam olarak bir kez etiketlenir ----------------------
for (const [name, asset] of Object.entries(ASSETS)) {
  const pattern = new RegExp(`(?:href|src)="${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
  const hits = html.match(pattern) ?? [];
  assert.equal(hits.length, 1, `${name} (${asset}) index.html içinde tam olarak bir kez yer almalı, bulunan: ${hits.length}`);
}

// --- Sıra: biçem → ayrıştırıcı → sohbet köprüsü ----------------------------
{
  const styleAt = html.indexOf(`href="${ASSETS.style}"`);
  const rendererAt = html.indexOf(`src="${ASSETS.renderer}"`);
  const chatAt = html.indexOf(`src="${ASSETS.chat}"`);
  assert.ok(styleAt >= 0 && rendererAt >= 0 && chatAt >= 0, 'üç varlık da sayfada bulunmalı');
  assert.ok(styleAt < rendererAt, 'biçem ayrıştırıcıdan önce gelir');
  assert.ok(
    rendererAt < chatAt,
    'chat-markdown.js, window.HafizeMarkdown üzerinden ayrıştırıcıyı okur; markdown-renderer.js ondan önce gelmeli'
  );
}

// --- Betikler `defer` taşır: DOM hazır olmadan çalışmazlar ------------------
for (const asset of [ASSETS.renderer, ASSETS.chat]) {
  assert.match(html, new RegExp(`<script src="${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" defer></script>`), `${asset} defer ile yüklenmeli`);
}

// --- Hiçbir modül aynı varlıkları ikinci kez enjekte etmez ------------------
//
// `index.html` zaten üçünü de yüklüyor; bir modülün ayrıca `createElement` ile
// aynı adresi eklemesi ikinci bir kopya çalıştırır. Kendi etiketini üreten tek
// yer sayfanın kendisidir.
{
  const injectors = [];
  for (const name of fs.readdirSync('public')) {
    if (!name.endsWith('.js') || name === 'sw.js') continue;
    const source = fs.readFileSync(path.join('public', name), 'utf8');
    // Dinamik bir `<script>`/`<link>` ürettiği *ve* katmanın adreslerinden
    // birini andırdığı durum aranıyor.
    const createsTag = /createElement\(\s*['"](?:script|link)['"]\s*\)/.test(source);
    if (!createsTag) continue;
    if (Object.values(ASSETS).some((asset) => source.includes(asset))) injectors.push(name);
  }
  assert.deepEqual(
    injectors,
    [],
    `markdown katmanını dinamik olarak da yükleyen modül(ler) var: ${injectors.join(', ')} — index.html bunları zaten yüklüyor`
  );
}

// --- Servis çalışanı kabuğu üçünü de taşır ---------------------------------
{
  const swPolicy = fs.readFileSync('public/sw-policy.js', 'utf8');
  for (const asset of Object.values(ASSETS)) {
    assert.ok(swPolicy.includes(`'${asset}'`), `${asset} çevrimdışı kabuk önbelleğinde yok`);
  }
}

console.log('chat markdown loader OK: üç varlık sayfada tek kopya, doğru sırada, ikinci enjeksiyon yok');
