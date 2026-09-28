# Recurrence Hata Modları

## Geçersiz recurrence
Malformed shape API'de 400 olur.
Store snapshot malformed ise persistence startup reddeder.
UI kullanıcının formunu silmeden hata status'u gösterir.

## Tarih üretim hatası
Geçersiz runAt veya now değeri occurrence hesaplamasını durdurur.
Önceki kayıt state'i mutation kuyruğu nedeniyle korunur.

## Retry
RetryAt gelecekte ise aynı occurrence devam eder.
RetryAt geçersizse mutation başarısız olur.
Final failure recurring seriyi durdurmaz; yeni occurrence planlanır.

## Capacity
Yeni manuel kayıt kapasiteye takılabilir.
Recurring occurrence yeni entry açmadığından seri devamı capacity tüketmez.

## Storage save
Persistence adapter save başarısızsa state memory'ye commit edilmez.
Kullanıcı tekrar deneyebilir.

## Broken history
History alanındaki unknown key'ler normalize edilir.
Secret veya output alanı geçmişe kabul edilmez.

## Preset import
256 KB üstü dosya okunmaz.
JSON parse hatası mevcut presetleri değiştirmez.
Duplicate title yeni kayıt tarafından gölgelenmez.

## Browser failure
localStorage erişimi yoksa preset tarafı status ile başarısız olur.
FileReader hata verirse mevcut kayıt korunur.
URL revoke planı export sonrası çalıştırılır.

## Observability
Hata mesajları bounded ve kullanıcıya uygun seviyededir.
Credential veya stack trace browser'a yazılmaz.
