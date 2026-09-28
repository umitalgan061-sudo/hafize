# Recurrence Rollback

## Kod rollback
Recurrence feature commitleri revert edilir.
Schema migration yapılmadığı için eski kayıt formatı ayrıca geri çevrilmez.

## UI rollback
Recurring controls, history, dashboard ve preset assets kaldırılabilir.
Existing one-shot schedule paneli çalışmaya devam eder.

## Data
recurrence, seriesId, seriesStartAt, occurrenceCount ve history recurring extension alanlarıdır.
Legacy consumer bilinmeyen alanları desteklemiyorsa export/restore öncesi normalize edilmelidir.

## Cache
Service worker cache version eski sürüme dönerse yeni recurrence assetleri cache'lenmez.
API cache'lemesi yapılmadığı için stale schedule response üretimi engellenir.

## User safety
Rollback kullanıcıyı otomatik olarak yeni schedule oluşturmaya zorlamaz.
Pause durumundaki seriler operasyonel rollback öncesi gözden geçirilmelidir.

## Evidence
Merge commit, base SHA, head SHA ve Git diff kaydı release notunda tutulmalıdır.
