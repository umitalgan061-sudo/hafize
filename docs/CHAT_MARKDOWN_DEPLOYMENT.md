# Chat Markdown Deployment Notları

## Asset sırası

`auth.js` ve `app.js` mevcut sohbet shell'inin temelidir. Markdown renderer `app.js` sonrasında defer edilir. Böylece uygulama sohbet state'ini üretir ve renderer mevcut mesajları sonradan zenginleştirir.

Stylesheet chat CSS katmanlarının yanında yüklenir. Renderer CSS'i global utility selector'ları değiştirmez; yalnız `.message.assistant .content` altındaki `.md-*` sınıflarını hedefler.

## Cache

`CURRENT_CACHE` yeni shell revision'a yükseltilir. JS ve CSS aynı revision altında dağıtılır. Eski shell cache'lerinin temizlenmesi existing service worker policy ile yapılır.

## Güvenlik başlatma

Markdown renderer herhangi bir auth endpoint'i çağırmaz ve kullanıcı session bilgisini okumaz. Bu nedenle public shell'de çalışırken authentication boundary'yi etkilemez.

## Canary

İlk smoke test kısa bir plain assistant response ile yapılır. Ardından code, table ve link örnekleri sırayla denenir. Hostile URL ve HTML metni de test edilir.

## Rollout kriteri

Parser syntax testi, security source testi, PWA asset testi ve stream observer testi geçmeden feature release edilmiş sayılmaz. Tam check mümkünse ayrıca filtrelenmeden çalıştırılır.

## Telemetry

Renderer telemetri göndermez. Hata görünürlüğü browser testleri, release smoke ve kullanıcı raporları üzerinden sağlanır. Bu, model içeriğinin üçüncü taraf analytics'e çıkmasını önleyen bilinçli karardır.

## Compatibility

Eski konuşmalar migration olmadan çalışır; raw message content aynı kalır. Renderer kaldırılırsa plain text gösterimi minimum fallback'tir.
