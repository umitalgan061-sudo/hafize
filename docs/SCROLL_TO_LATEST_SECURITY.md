# Scroll-to-latest UX boundary

Hafize uzun veya streaming sohbetlerde kullanıcının okuma konumuna saygı gösterir.

## Davranış

- Kullanıcı sohbetin en altına **96 piksel** içinde ise ekran `pinned` kabul edilir.
- Pinned durumda yeni mesaj veya streaming metin değişikliği geldiğinde görünüm en alta `auto` davranışıyla takip eder.
- Kullanıcı yukarı kaydırdıysa yeni içerik onu zorla aşağı kaydırmaz.
- Bu durumda görünür kontrol önce `En alta git`, yeni içerik geldikten sonra `Yeni yanıt` olarak gösterilir.
- Kontrole açık kullanıcı tıklaması en alta götürür.
- `prefers-reduced-motion: reduce` etkinse kullanıcı tıklamasında smooth animasyon kullanılmaz.

## Veri sınırı

Controller yalnız scroll metriklerini ve `#messages` içindeki DOM mutation sinyallerini gözler.

- Mesaj içeriği okunmaz, kopyalanmaz veya indekslenmez.
- `.content`, `data-message-id`, tool activity veya trace metadata okunmaz.
- `localStorage`, `sessionStorage`, cookie, clipboard, fetch veya WebSocket kullanılmaz.
- Credential, owner ID veya provider verisi controller'a girmez.

## Yaşam döngüsü

- Scroll listener passive olarak bağlanır.
- MutationObserver yalnız `#messages` altında `childList`, `subtree` ve `characterData` değişikliklerini dinler.
- `destroy()` observer'ı, scroll listener'ını, pending animation frame'i ve görünür kontrolü temizler.
- Controller ikinci kez mount edilirse aynı instance üzerinde yeni listener üretmez.

## PWA sınırı

`/scroll-to-latest.js` statik shell asset'idir. Service worker `/api/*` cevaplarını network-only bırakır; sohbet/API cevapları cache'e alınmaz.

## Geri alma

Loader satırı, shell asset kaydı, controller, bu doküman ve testi revert etmek yeterlidir. `app.js`, konuşma veri formatı ve backend sözleşmeleri değişmez.
