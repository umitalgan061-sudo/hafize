# Zamanlanmış Görevler — Privacy

## Veri kategorileri

Schedule kayıtları task text, agentId, runAt, status, attempts, maxAttempts, error code ve trace metadata içerir.

OwnerId server tarafında tutulur ve response içinde yayınlanmaz.

Client task status'ını localStorage'a kopyalamaz.

## Amaç sınırlaması

Task content schedule execution amacıyla saklanır.

Trace ID operasyonel debugging içindir.

UI'daki status filter yalnızca kullanıcı arayüzünü filtreler.

## Client storage

Schedule token localStorage'a yazılmaz.

Schedule response localStorage'a yazılmaz.

Task text localStorage'a otomatik taslak olarak yazılmaz.

Bu tercih, schedule UI'nin hassas görev içeriğini cihazdaki genel web storage'a çoğaltmamasını sağlar.

## Network

UI yalnızca same-origin schedule API çağrısı yapar.

API request credentials browser session'dan gelir.

Üçüncü taraf analytics endpoint'i eklenmemiştir.

Task content üçüncü taraf telemetry'ye ayrıca gönderilmez.

## PWA cache

Static schedule assets cache'lenebilir.

Schedule API response'ları cachelenmez.

Offline shell, eski görev içeriğini canlı görev listesi gibi göstermez.

## Logging

Client console'a task text loglamaz.

Client console'a schedule auth token loglamaz.

Error rendering bounded code/metin kullanır.

Trace ID user-facing support metadata olarak gösterilebilir.

## Support privacy

Support taleplerinde task text gereksiz yere istenmemelidir.

Mümkünse yalnızca status, error code ve Trace ID kullanılır.

Secret veya bearer token support kanalında istenmez.

## Retention

Bu UI retention politikası uygulamaz.

Server schedule store kendi lifecycle/retention kurallarının otoritesidir.

UI eski kayıtları otomatik silmez.

## Export

Bu release schedule export özelliği sunmaz.

Bu bilinçli bir sınırdır; export eklenirse privacy/data model review gerektirir.

## Cross-user isolation

Server list command authenticated principal'a göre filtre uygular.

UI başka kullanıcının schedule'ını client filtresiyle gizlemeye güvenmez.

## Browser history

Task API URL'leri query string ile task content taşımaz.

Schedule ID path'te encode edilir.

Task body URL'ye eklenmez.

## Clipboard

Scheduled Tasks UI task content'i clipboard'a kopyalamaz.

Bu release'de Trace ID için de clipboard yazma özelliği yoktur.

## Screenshot/privacy

Scheduled Tasks UI otomatik ekran görüntüsü almaz.

Mevcut screen-share özelliği ayrı yüzeydir ve schedule task data ile birleştirilmez.

## Shared device

UI task verisini browser storage'a kalıcı kopyalamadığı için shared-device persistence azaltılmıştır.

Server account session yine kullanıcı sorumluluğundadır.

## Threats

Malicious extension riskine client UI üzerinden koruma sözü verilmez.

Browser devtools erişimi olan kullanıcı kendi session verisini inceleyebilir.

Bu release server-side authorization'ı asıl güvenlik kontrolü olarak kabul eder.

## Privacy acceptance

No client telemetry.

No secret persistence.

No schedule response caching.

No task content in URL.

No task content in console logging.

Owner filtering server-side.

## Future work

Explicit schedule deletion/retention UI eklenirse privacy review yapılmalıdır.

Notification integrations eklenirse third-party data sharing contract gerekir.

Export eklenirse user confirmation ve file redaction düşünülmelidir.
