# Kod bloğu büyük görünüm sözleşmesi

`public/code-block-focus.js`, güvenli Markdown kod bloklarını kullanıcı isteğiyle geçici büyük bir dialog içinde okumayı sağlar.

- Yalnız mevcut `.hafize-code-shell pre > code` düz metni okunur; maksimum 256 KiB sınırı vardır.
- `Büyüt` düğmesi açık kullanıcı eylemidir. Kod çalıştırılmaz, değiştirilmez, clipboard'a yazılmaz veya ağa gönderilmez.
- Dialog `role=dialog`, `aria-modal`, `aria-labelledby`, Escape/backdrop kapatma ve focus restore kullanır.
- Kod içeriği yalnız `textContent` ile taşınır; `innerHTML` kullanılmaz.
- Dil etiketi yalnız `^[\w.+-]{1,32}$` allowlist biçiminden geçerse gösterilir.
- Network, storage, cookie, submit ve tool çağrısı yoktur.
- Tercih veya kod kalıcı olarak saklanmaz; dialog kapanınca geçici kod görünümü temizlenir.
- `/code-block-focus.js` PWA shell v39 asset'idir; `/api/*` network-only kalır.

Geri alma sırasında controller, loader/PWA wiring, test ve bu belge kaldırılır; mevcut kod kopyalama ve satır sarma davranışları korunur.
