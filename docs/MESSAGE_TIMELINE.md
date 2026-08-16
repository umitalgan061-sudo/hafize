# Mesaj zaman çizelgesi sözleşmesi

`public/message-timeline.js`, aktif konuşmadaki render edilmiş mesajlara Hafize'nin zaten sakladığı gönderim zamanını görünür ve erişilebilir biçimde ekler.

## Veri sınırı

- Yalnız `hafize.conversations.v1` anahtarındaki mevcut yerel konuşma kaydı okunur.
- Mesaj içeriği, tool activity, agent metadata veya secret alanları işlenmez.
- Yalnız `message.id` ile `message.at` eşleştirilir.
- En fazla 30 konuşma ve konuşma başına 2000 mesaj taranır.
- Geçersiz JSON, bozuk tarih veya eşleşmeyen message id fail-closed biçimde yok sayılır.
- Bu özellik localStorage'a yazmaz, konuşma verisini değiştirmez veya ağa göndermez.

## Görünüm

Her eşleşen mesajın `meta` satırında yerel saat gösterilir. Tam tarih ve saat `title` ve erişilebilir `aria-label` içinde bulunur. Gün değiştiğinde konuşma içinde `Bugün`, `Dün` veya tam tarih etiketli ayraç eklenir.

Mesajlar yeniden render edildiğinde MutationObserver görünümü yeniden kurar. Başka sekmede aynı Hafize konuşma kaydı değişirse yalnız ilgili `storage` olayı zaman çizelgesini tazeler.

## Güvenlik

Network, clipboard, form submit, tool çağrısı veya local/session storage yazımı yoktur. Backend default-deny tool ve approval sözleşmeleri değişmez.

## PWA

`/message-timeline.js` same-origin shell asset olarak cache v44 kapsamındadır. `/api/*` istekleri network-only kalır.

## Geri alma

Controller, loader satırı, PWA asset kaydı, testler ve bu belge kaldırılırsa mesaj içeriği ve sohbet geçmişi değişmeden yalnız zaman damgası/gün ayraçları kaybolur.
