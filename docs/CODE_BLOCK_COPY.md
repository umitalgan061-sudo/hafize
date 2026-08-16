# Kod bloğu kopyalama sözleşmesi

`public/code-block-copy.js`, güvenli Markdown renderer tarafından üretilmiş assistant kod bloklarına görünür `Kodu kopyala` kontrolü ekler.

## Veri sınırı

Yalnız `.message.assistant .content.hafize-markdown pre > code` düz metni okunur. Mesajın geri kalanı, tool activity, trace, agent metadata, storage veya başka konuşmalar okunmaz. Kod 256 KiB ile bounded; daha büyük bloklarda kopyalama fail-closed kalır.

## Kullanıcı kontrolü

Clipboard yazımı yalnız görünür düğmeye açık kullanıcı tıklamasıyla başlar. Secure context ve `navigator.clipboard.writeText` yoksa işlem yapılmaz. Network, storage, cookie, submit veya tool çağrısı yoktur.

Renderer dil etiketi sağladıysa yalnız `^[\w.+-]{1,32}$` biçimindeki değer görsel etiket ve aria-label içinde kullanılır. Kod hiçbir zaman HTML olarak yorumlanmaz.

## PWA

Asset same-origin shell enhancement olarak yüklenir ve PWA shell cache v35 kapsamındadır. `/api/*` network-only kalır.

## Geri alma

Controller, loader/PWA wiring, testler ve bu belge kaldırıldığında Markdown render davranışı korunur; yalnız kod bloğu kopyalama kontrolü kaybolur.
