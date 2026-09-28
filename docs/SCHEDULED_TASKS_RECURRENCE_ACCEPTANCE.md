# Recurrence Kabul Kriterleri

## Create
Tek seferlik kayıt recurrence alanı olmadan oluşturulabilmeli.
Daily 1–30 interval kabul edilmeli.
Weekly en az bir gün seçilmeden reddedilmeli.
Monthly dayOfMonth olmadan reddedilmeli.
Unknown recurrence field 400 ile reddedilmeli.

## Execution
Running → completed geçişi recurring kayıtta history yazmalı.
Completion sonrası status scheduled olmalı.
attempts sıfırlanmalı.
runAt gelecek occurrence'a taşınmalı.
occurrenceCount bir artmalı.

## Failure
Ara retry mevcut behavior'ı korumalı.
Final failure history'ye yazılmalı.
Recurring series sonraki occurrence'a taşınmalı.
Non-recurring final failure failed kalmalı.

## Cancel
Scheduled recurring kayıt cancel olabilmeli.
Cancelled kayıt claimDue tarafından tekrar alınmamalı.

## Persistence
Restart sonrası recurrence aynı değerle geri gelmeli.
History en fazla 20 olmalı.
Legacy snapshot absence alanları varsayılanlarla açılmalı.

## UI
Recurrence seçicisi erişilebilir olmalı.
Haftalık günleri yalnız weekly modunda görünmeli.
Aylık gün alanı yalnız monthly modunda görünmeli.
History paneli toggle edilebilmeli.

## Preset
Yeni preset formdan alınmalı.
Use preset recurrence ve agent alanlarını aktarmalı.
Delete explicit confirmation gerektirmeli.
Import mevcut presetleri başlığa göre korumalı.

## Non-goals
Task output caching.
Secret persistence.
API dışı background scheduling.
Server-side cron ayarı değiştirme.
