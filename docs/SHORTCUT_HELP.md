# Klavye kısayolları yardım penceresi

## Amaç

Hafize'nin mevcut klavye davranışlarını kullanıcıya görünür, erişilebilir ve tek yerde keşfedilebilir hale getirmek. Bu katman yeni bir tool, network veya veri erişim yetkisi eklemez.

## Davranış

- Sol menünün altına `Klavye kısayolları` düğmesi eklenir.
- Yazı alanı dışında `?` tuşu aynı yardım penceresini açar.
- Pencere açıldığında odak `Kapat` düğmesine taşınır.
- `Escape`, görünür `Kapat` düğmesi veya backdrop tıklaması pencereyi kapatır.
- Kapanışta odak pencereyi açan kontrole döner.
- `Tab` / `Shift+Tab` odağı modal içinde tutar.
- Input, textarea, select ve contenteditable alanlarında `?` normal metin girişi olarak kalır.

## Gösterilen kısayollar

Pencere yalnız uygulamada zaten bulunan davranışları açıklar: composer odaklama, yanıt durdurma ve sohbet geçmişinde yön tuşlarıyla gezinme. Yardım katmanı bu davranışların kendisini yeniden uygulamaz.

## Veri ve güvenlik sınırı

`shortcut-help.js`:

- mesaj veya sohbet içeriğini okumaz;
- localStorage/sessionStorage/cookie kullanmaz;
- `fetch`, clipboard veya dış servis çağrısı yapmaz;
- submit, tool çağrısı, repo yazımı veya dış gönderim üretmez;
- yalnız kendi oluşturduğu modal DOM düğümleri ve klavye event'leriyle çalışır.

Ajan registry, backend default-deny tool authorization, external write/send/merge approval ve secret isolation sözleşmeleri değişmez.

## PWA

`/shortcut-help.js` statik shell asset'idir. `/api/*` istekleri service worker tarafından network-only kalır.

## Geri alma

Controller, loader satırı, PWA shell kaydı, test ve bu belge birlikte kaldırılabilir; sohbet/veri modeli etkilenmez.
