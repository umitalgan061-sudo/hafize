# Mobil sidebar kapatma davranışı

## Amaç

Mobil görünümde açık sol menünün kullanıcı tarafından hızlı ve öngörülebilir biçimde kapatılmasını sağlar. Bu katman yalnız navigasyon görünürlüğünü yönetir; sohbet, model, ajan veya tool state'ini değiştirmez.

## Davranış

- 900 px ve altında sidebar açıksa görünür backdrop gösterilir.
- Backdrop tıklaması sidebar'ı kapatır ve odağı menü düğmesine döndürür.
- Escape yalnız mobil görünümde ve sidebar gerçekten açıksa kapatma yapar.
- Viewport masaüstü boyutuna geçtiğinde açık mobil sidebar kapatılır.
- `aria-expanded` sidebar'ın gerçek `open` class durumuyla senkron tutulur.
- Controller mount/destroy yaşam döngüsü idempotenttir.

## Güvenlik ve veri sınırı

- Mesaj, conversation ID, model, agent, tool activity veya credential okunmaz.
- Network, storage, cookie, clipboard veya dış yazma yoktur.
- Backdrop yalnız görünür kullanıcı etkileşimi sağlar; otomatik submit veya tool çağrısı üretmez.
- Backend default-deny tool policy, approval, trace ve secret sözleşmeleri değişmez.

## PWA

`/mobile-sidebar-dismiss.js` same-origin shell asset olarak cache'lenebilir. `/api/*` network-only politikası değişmez.
