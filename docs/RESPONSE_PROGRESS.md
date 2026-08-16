# Yanıt ilerleme durumu

`public/response-progress.js`, mevcut sohbet streaming durumunu yeni bir backend olayı üretmeden görünür ve erişilebilir hale getirir.

## Durumlar

- `idle`: aktif streaming yoktur; durum satırı gizlidir.
- `preparing`: gönder düğmesi streaming durumundadır fakat son Hafize mesajında henüz görünür içerik yoktur; `Hafize yanıt hazırlıyor…` gösterilir.
- `streaming`: son Hafize mesajına görünür içerik gelmiştir; `Hafize yanıt yazıyor…` gösterilir.

Controller mevcut `#sendBtn.streaming` sınıfını ve aktif sohbetin render edilmiş son `.message.assistant .content` metnini izler. Model adı, prompt, tool metadata, trace veya secret okumaz.

## Erişilebilirlik

Durum satırı `role=status`, `aria-live=polite` ve `aria-atomic=true` kullanır. `#messages` aktif yanıt boyunca `aria-busy=true`, idle durumda `aria-busy=false` olur. Controller kaldırıldığında önceki `aria-busy` değeri geri yüklenir.

Animasyon yalnız `prefers-reduced-motion:no-preference` durumunda küçük bir durum noktasıyla gösterilir.

## Güvenlik sınırı

Bu özellik salt UI gözlemidir. Network/fetch, storage, clipboard, submit, tool, connector veya agent çağrısı yapmaz; mesaj içeriğini değiştirmez ve otomatik gönderim üretmez.
