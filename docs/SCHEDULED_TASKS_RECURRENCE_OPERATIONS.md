# Recurrence Operasyonları

## İzlenecek alanlar
scheduleId
seriesId
status
runAt
occurrenceCount
history.length
lastError

## Normal günlük operasyon
Worker due görevleri claim eder.
Execution başarılıysa next occurrence hesaplanır.
Store kalıcı ise mutation adapter'a yazılır.

## Retry
Bir oluşum maxAttempts altında başarısız olursa mevcut retryAt yolu kullanılır.
Retry gerçekleşmeden history kaydı oluşturulmaz.
Son retry başarısız olduğunda oluşum history'ye failed olarak yazılır ve seri devam eder.

## Lease
SCHEDULE_LEASE_BUSY defer yolunu kullanmaya devam eder.
Defer attempt sayacını geri verir; oluşum tarihi değişmez, yalnız bir sonraki deneme zamanı ötelenir.

## Kapasite
Yeni seri yaratmak kapasiteyi aşmamalıdır.
Otomatik next occurrence yeni kayıt yaratmadığından 128 entry limiti değişmez.

## Cancel
Kullanıcı seriyi durdurmak için mevcut schedule kaydını iptal eder.
İptal sonrası worker yeni occurrence üretmez.

## Arıza
Recurrence matematiği geçersiz olursa store mutation başarısız olur.
Persistence rollback ile önceki snapshot korunur.
UI kullanıcıya genel hata gösterir; ham stack veya secret açığa çıkmaz.

## Recovery
Snapshot restore sırasında recurrence normalize edilir.
History yalnız güvenli alanlarla geri alınır.
Bozuk history elemanı tüm snapshot'ı sessizce kirletmemelidir; testler bunu kapıdan geçirir.

## Operasyon notu
API list endpoint'i recurring kaydın history özetini sunabilir.
Gerçek çalışma çıktıları başka logging sistemlerinde tutulmaz.
