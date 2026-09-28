# Recurrence Design

## Principle
Bir schedule record bir recurring series'i temsil eder.
Yeni occurrence yeni schedule entry oluşturmaz.

## Benefits
Capacity 128 schedule entry olarak kalır.
Series identity sabit kalır.
Cancel ve pause tek kaydı yönetir.
History series üzerinde tutulur.

## Execution
claimDue record'u running yapar.
complete veya final failure occurrence'ı history'ye yazar.
Recurring record scheduled durumuna ve gelecek runAt'a döner.
Retry mevcut occurrence içinde attempt olarak kalır.

## Anchor
seriesStartAt immutable series metadata'dır.
Weekly interval hesapları previous occurrence yerine series anchor kullanır.
Daily ve monthly hesapları zaman bilgisini korur.

## Boundaries
Server cron configuration değişmez.
Existing worker loop devam eder.
Lease ve defer semantiği korunur.

## Future
Timezone desteği ancak DST ve IANA semantics net tanımlandıktan sonra expose edilmelidir.
Mevcut hesaplama stored ISO timestamps kullanır.

## Non-goals
Task output history.
Automatic task creation per occurrence.
Remote analytics.
