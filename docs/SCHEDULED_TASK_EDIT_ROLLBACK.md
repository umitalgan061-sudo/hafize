# Schedule Edit Rollback

## Ön koşul
Feature rollout sırasında PATCH veya UI edit akışında kritik sorun görülürse PR revert edilebilir.

## Etki
Revert sonrası yeni edit/quick postpone/bulk edit işlemleri kullanılamaz. Mevcut GET/POST/DELETE schedule akışı korunur.

## Veri
Rollback schedule snapshot'larını silmez. Mevcut kayıtlar worker tarafından mevcut state machine ile işlenmeye devam eder.

## Uygulama
1. Feature PR'ını revert et.
2. Main deploy et.
3. Schedule listesi ve worker health kontrol et.
4. `/api/schedules/:id` üzerinde PATCH çağrılarının kaldırıldığını doğrula.
5. `/api/schedules` GET/POST ve DELETE smoke testlerini çalıştır.

## Sonrası
Yeni deneme için aynı branch yeniden kullanılmaz; yeni `auto-*` branch açılır.
