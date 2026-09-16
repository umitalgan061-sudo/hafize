# Schedule Edit Security

## Güvenlik sınırı
Frontend formu yalnızca kullanım kolaylığı sağlar. Güvenlik kararı `schedule-command-boundary.mjs` içinde tekrar verilir.

## Ownership
Her güncelleme authenticated principal subject ile schedule ownerId karşılaştırılarak kontrol edilir.

## Credential politikası
Yeni task metni oluşturulurken kullanılan `containsPlaintextCredential` kontrolü güncelleme sırasında da çalışır.

## Durum geçişi
`scheduled -> scheduled` dışında bir edit geçişi yoktur. Çalışan bir görevi edit ederek execution state değiştirmek mümkün değildir.

## Kimlik bilgileri
Public schedule response ownerId döndürmez. Trace ID kullanıcıya gösterilebilir ancak secret değildir.

## HTTP yüzeyi
PATCH ayrı bir mutation'dır. GET/POST kök endpoint davranışı ve DELETE iptal akışı korunur.

## Hata ayrımı
Yetkisiz veya başkasına ait kayıt `SCHEDULE_NOT_FOUND` olarak maskelenir. Düzenlenemeyen mevcut sahiplikli kayıt `SCHEDULE_NOT_EDITABLE` ile ayrılır.

## Browser
Schedule gövdesi browser storage'a kaydedilmez. Service worker `/api/` çağrılarını network-only bırakır.
