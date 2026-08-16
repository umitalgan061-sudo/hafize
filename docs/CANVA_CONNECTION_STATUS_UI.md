# Canva Connection Status UI

## Amaç

Bu geliştirme Hafize'nin mevcut Canva read-only connector durumunu kullanıcıya görünür hale getirir. Yeni OAuth akışı, yeni connector yetkisi veya Canva üzerinde yazma davranışı eklemez.

Kart iki mevcut sunucu sinyalini kullanır:

1. `GET /api/health` içindeki `canvaReadConfigured` boolean değeri.
2. Connector yapılandırılmışsa authenticated `GET /api/connectors/canva/status` yanıtındaki `linked` boolean değeri.

## Durum modeli

Kart yalnız şu durumları gösterir:

- `Kapalı`: Canva read-only runtime sunucuda yapılandırılmamış.
- `Oturum gerekli`: runtime hazır fakat bağlantı durumunu okumak için Hafize principal authentication gerekli.
- `Bağlı değil`: authenticated kullanıcı için Canva token kaydı bulunmuyor.
- `Bağlı`: authenticated kullanıcı için read-only Canva bağlantısı mevcut.
- `Bilinmiyor`: health veya status yanıtı doğrulanamadı.

`401 AUTH_REQUIRED` genel ağ hatası olarak gösterilmez; kullanıcıya güvenli oturum gereksinimi açıkça belirtilir.

## Veri ve secret sınırı

İstemciye yalnız boolean hazır-olma/bağlantı sinyalleri gelir. Kart şunları istemez, işlemez veya göstermez:

- access token veya refresh token,
- OAuth client secret,
- connector ownerId,
- Hafize connector bearer tokenı,
- owner encryption key,
- Canva tasarım içeriği veya kişisel connector verisi.

Sunucu bağlantı endpoint'i zaten token store kaydını yalnız var/yok olarak indirger. UI bu sözleşmeyi genişletmez.

## Ağ sınırı

Kart yalnız same-origin GET kullanır. Her iki istek de `cache: no-store` ve `credentials: same-origin` ile yapılır. Connector kapalıysa authenticated status endpoint'i çağrılmaz.

Yeni endpoint, form submit, POST/PUT/PATCH/DELETE, WebSocket, EventSource, sendBeacon veya clipboard işlemi yoktur.

## Tool policy

Bu kart ajan tool permission sözleşmesini değiştirmez. Canva tool yüzeyi mevcut backend default-deny policy içinde salt-okunur kalır. Tasarım oluşturma, düzenleme, paylaşma, silme veya başka dış yazma eylemleri eklenmez.

Dört profilli selector/specialist roster değişmez ve yeni ajan eklenmez.

## UX ve erişilebilirlik

Kart utility rail içinde görünür. Durum `role=status`, `aria-live=polite`, `aria-atomic=true` ile duyurulur. Yenile native button'dır ve istek sırasında disabled olur.

Mobil görünümde dokunma hedefi büyütülür. `prefers-reduced-motion` ve `forced-colors` ortamları için ayrı stiller vardır.

## PWA

`canva-connection-status.js`, style loader ve CSS shell cache'e eklenmiştir. `/api/health` ve `/api/connectors/canva/status` servis worker tarafından cache'lenmez; `/api/*` network-only kalır.

## Geri alma

Revert sırasında Canva status JS/CSS/style-loader, testler, bu belge, `chat-run-controller.js` loader satırları ve PWA shell asset kayıtları kaldırılır. Backend Canva runtime, token store ve mevcut connector API'sinde migrasyon veya veri değişikliği yoktur.
