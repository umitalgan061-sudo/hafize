# Güvenli Markdown render sözleşmesi

Hafize assistant yanıtlarını Claude-benzeri okunabilir bloklara dönüştürürken HTML string çalıştırmaz. `public/safe-markdown-render.js` yalnız DOM API ile önceden belirlenmiş elementleri üretir.

## Desteklenen yüzey

- H1–H3 başlıklar
- paragraf ve satır sonları
- sıralı/sırasız listeler
- blockquote ve yatay ayraç
- fenced code block + dil etiketi metadata'sı
- inline code, bold, italic
- http/https/mailto linkleri

## Güvenlik sınırı

`innerHTML`, `insertAdjacentHTML`, DOMParser, eval veya remote renderer kullanılmaz. Model çıktısı HTML olsa bile metin olarak kalır. Link protokolü allowlist'tir; `javascript:`, `data:`, `file:`, `blob:` ve benzeri protokoller linke dönüşmez. Açılan güvenli linklerde `noopener noreferrer` uygulanır.

Renderer yalnız `.message.assistant .content` alanına uygulanır. Kullanıcı mesajları değiştirilmez. Network, storage, cookie, clipboard, submit veya tool çağrısı yoktur. Kaynak metin 256 KiB ile bounded; aşımda render fail-closed kalır.

## PWA ve runtime

Asset same-origin shell enhancement olarak `chat-run-controller.js` tarafından yüklenir ve PWA shell cache v34 kapsamındadır. `/api/*` istekleri network-only kalmaya devam eder.

## Geri alma

Renderer, loader satırı, PWA asset kaydı, testler ve bu belge kaldırıldığında uygulama önceki düz metin assistant görünümüne döner; sohbet verisi formatı değişmez.
