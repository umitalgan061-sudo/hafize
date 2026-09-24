# Bağlantılar operasyon runbook'u

## Sağlık kontrolü

1. /api/health 200 dönüyor mu?
2. Gmail status endpoint'i doğru auth kodu döndürüyor mu?
3. Canva status endpoint'i doğru auth kodu döndürüyor mu?
4. UI refresh sonucunu render ediyor mu?

## Tarayıcı kontrolü

- Console'da connector hub exception var mı?
- Ağ sekmesinde yalnız GET isteği var mı?
- Üçüncü taraf endpoint çağrısı var mı?
- storage içinde credential var mı?

## PWA

Service worker yalnız connector-hub.js ve connector-hub.css asset'lerini shell'e almalıdır. API cevapları cache'lenmemelidir.

## Release

- kaynak syntax
- workspace kartları
- API contract
- security
- accessibility
- PWA
- lifecycle

kontrolleri tamamlanır.

## Gözlem

Hub remote telemetry kullanmaz. Production gözlemi server status endpoint ve normal application logları üzerinden yapılır.

## Support

Kullanıcıdan token istemeyin. Önce oturum, sonra backend connector yapılandırması ve en son provider link durumunu kontrol edin.

## Incident

Bir credential'ın UI'a sızdığı görülürse özellik derhal revert edilir ve ilgili server credential rotasyonu ayrı operasyon olarak yürütülür.

## Rollback

UI asset'leri kaldırılır. Server connector runtime'ları değişmeden kalabilir.

## Operasyon ilkesi

Hub gözlem katmanıdır; production policy enforcement katmanlarını yeniden uygulamaz.
