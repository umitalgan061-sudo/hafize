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

## Yaşam döngüsü ve DOM sahipliği

- Scroll listener passive olarak bağlanır ve aynı exact handler referansıyla kaldırılır.
- MutationObserver yalnız `#messages` altında `childList`, `subtree` ve `characterData` değişikliklerini dinler.
- Controller `#scrollToLatestBtn` zaten DOM'da varsa düğmeyi **ödünç alır**; destroy sırasında host tarafından sağlanan düğmeyi kaldırmaz.
- Düğmeyi controller kendisi oluşturduysa ownership RAM'de tutulur ve yalnız bu durumda destroy sırasında düğme DOM'dan kaldırılır.
- Click listener anonymous değildir; preexisting veya controller-owned düğmeden teardown sırasında exact olarak sökülür.
- `destroy()` mounted durumunu önce kapatır, observer/listener'ları temizler ve pending animation frame'i iptal eder.
- RAF callback'leri controller generation'ına bağlıdır. Eski mount'tan kalmış bir callback iptal mekanizmasına rağmen sonradan çalışırsa remount edilmiş yeni controller'ın düğmesini veya frame state'ini değiştiremez.
- `handleScroll`, `handleMutation`, `scrollToBottom` ve measurement scheduling destroy sonrasında inert kalır; doğrudan çağrı bile yeni scroll veya RAF işi başlatmaz.
- Aynı controller yeniden mount edilirse preexisting düğmede click listener birikmez.
- Double destroy no-op davranır ve host DOM sahipliğine dokunmaz.

## PWA sınırı

`/scroll-to-latest.js` statik shell asset'idir. Service worker `/api/*` cevaplarını network-only bırakır; sohbet/API cevapları cache'e alınmaz.

## Geri alma

Loader satırı, shell asset kaydı, controller, bu doküman ve testi revert etmek yeterlidir. `app.js`, konuşma veri formatı ve backend sözleşmeleri değişmez.
