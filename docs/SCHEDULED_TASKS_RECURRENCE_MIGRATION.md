# Recurrence Migration

Yeni recurrence alanları optional olduğu için mevcut schedule snapshot'ları için destructive migration gerekmez.

## Legacy kayıtlar
recurrence yoksa null kabul edilir.
seriesId ve seriesStartAt null olur.
occurrenceCount 0 olur.
history boş dizi olur.

## Yeni kayıtlar
Yeni recurring create isteği normalize edilir.
Store seriesId ve seriesStartAt alanlarını kendisi üretir.
İstemci anchorAt gibi iç alanları sağlayamaz.

## Persistence
Schema version 1 korunur.
Restore sırasında eksik alanlar varsayılanla tamamlanır.
Geçersiz recurrence snapshot startup'ta reddedilir.

## Roll-forward
Yeni kod eski one-shot kayıtları okuyabilir.
Yeni UI tek sefer seçimini varsayılan tutar.

## Rollback
UI veya command katmanı geri alınsa bile eski kayıtlar okunabilir kalır.
Recurring kayıtlar destructive delete edilmez.

## Verification
Legacy snapshot, recurring snapshot ve round-trip testleri çalıştırılmalıdır.
seriesStartAt değerinin ilk runAt ile aynı kaldığı doğrulanmalıdır.
