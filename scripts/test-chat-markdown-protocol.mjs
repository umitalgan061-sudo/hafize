import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer = fs.readFileSync('public/markdown-renderer.js', 'utf8');
const chat = fs.readFileSync('public/chat-markdown.js', 'utf8');
const css = fs.readFileSync('public/chat-markdown.css', 'utf8');
assert.match(renderer, /renderMarkdown|parseMarkdown/);
assert.match(renderer, /LIMITS/);
assert.match(chat, /requestAnimationFrame/);
assert.match(chat, /aria-busy/);
assert.match(chat, /navigator\.clipboard/);
assert.match(css, /message\.assistant/);
// Biçem dosyası yalnızca asistan yanıtının içini biçimlendirir; sayfanın
// kendisine (`body`, `html`, `:root`) dokunmaz. Desen bir seçici sınırına
// çapalanır, aksi hâlde `.md-code-body` gibi bir sınıf adı da eşleşirdi.
assert.doesNotMatch(css, /(^|[,}\s])body\s*\{/m, 'body elemanı yeniden biçimlendirilmemeli');
assert.doesNotMatch(css, /(^|[,}\s])html\s*\{/m, 'html elemanı yeniden biçimlendirilmemeli');
// `:root` yalnızca bu katmanın kendi renk değişkenlerini tanımlayabilir.
// Buraya `--md-` dışında bir ad yazmak uygulamanın geri kalanının temasını
// sessizce değiştirirdi.
for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
  for (const declaration of block[1].split(';')) {
    const name = declaration.split(':')[0].trim();
    if (!name) continue;
    assert.ok(name.startsWith('--md-'), `:root içinde yalnızca --md-* tanımlanmalı, bulunan: ${name}`);
  }
}
console.log('chat markdown protocol contract: ok');
