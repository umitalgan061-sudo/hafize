# Kod bloğu indirme sözleşmesi

`public/code-block-download.js`, güvenli Markdown renderer içindeki kod bloklarına görünür `Kodu indir` kontrolü ekler.

## Kullanıcı kontrolü

- İndirme yalnız görünür düğmeye açık kullanıcı tıklamasıyla başlar.
- Kod çalıştırılmaz, değiştirilmez, clipboard'a yazılmaz veya ağa gönderilmez.
- İndirme tamamlandığında kısa süreli durum etiketi gösterilir; otomatik submit veya tool çağrısı yoktur.

## Veri ve dosya sınırı

- Yalnız `.message.assistant .content.hafize-markdown pre > code` düz metni okunur.
- Kod en fazla 256 KiB karakter olabilir; daha büyük bloklar fail-closed kalır.
- CRLF/CR satır sonları LF'ye normalize edilir ve NUL karakterleri çıkarılır.
- Dil etiketi yalnız `^[\w.+-]{1,32}$` doğrulamasından geçerse uzantı eşlemesinde kullanılır.
- Bilinen dil etiketleri dar bir allowlist ile dosya uzantısına çevrilir; bilinmeyen veya geçersiz dil `.txt` olur.
- Dosya adı yalnız `hafize-code.<uzantı>` biçimindedir; model metni dosya adına taşınmaz.

## Tarayıcı sınırı

Dosya tarayıcının yerel `Blob` + object URL mekanizmasıyla hazırlanır. Geçici anchor hemen kaldırılır ve object URL `finally` içinde revoke edilir. Blob veya object URL API'si yoksa işlem yapılmaz.

## Güvenlik

Controller `fetch`, XHR, WebSocket, beacon, local/session storage, cookie, clipboard, form submit, eval veya tool çağrısı yapmaz. Assistant kod içeriği yalnız `textContent` olarak okunur.

## PWA ve geri alma

`/code-block-download.js` same-origin shell asset'tir; shell cache v41'e yükselir ve `/api/*` network-only kalır. Controller, loader/PWA kaydı, testler ve bu belge kaldırılırsa mevcut kopyala/sar/büyüt kod bloğu davranışları korunur.
