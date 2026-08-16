# Gönderilmemiş taslak gezinme koruması

## Amaç

Hafize'de composer içindeki gönderilmemiş metnin yanlışlıkla başka bir konuşmaya taşınıp orada gönderilmesini önlemek.

## Davranış

- Composer'da anlamlı bir taslak varken `Yeni sohbet`, başka bir sohbeti açma, tüm geçmişi temizleme ve aktif sohbeti silme aksiyonları capture aşamasında durdurulur.
- Kullanıcıya görünür durum metni gösterilir ve odak composer'a döner.
- Kullanıcı taslağı gönderdiğinde veya `Taslağı temizle` akışıyla kaldırdığında gezinme yeniden serbest kalır.
- Aktif olmayan bir sohbeti silmek mevcut taslağın bağlamını değiştirmediği için engellenmez.

## Veri ve güvenlik sınırı

Controller yalnız `#messageInput.value` için boş/dolu kontrolü yapar. Metni loglamaz, kopyalamaz veya başka bir yere taşımaz. Network, storage, cookie, clipboard, tool çağrısı veya otomatik submit üretmez. Taslak içeriği ajan bağlamına girmez.

Bu guard mevcut backend default-deny tool permission, external write/send/merge approval, secret isolation ve dört profilli ajan registry sözleşmelerini değiştirmez.

## PWA

Asset same-origin shell dosyasıdır. `/api/*` istekleri service worker tarafından network-only kalmaya devam eder.
