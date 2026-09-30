# GitHub Write Approval Model

## Faz 1: Plan
UI action, repository, target branch/ref, path ve metin alanlarını normalize eder. Kullanıcı planı görür; henüz GitHub'a write yapılmaz.

## Faz 2: Approval
Kullanıcı checkbox ile planı onaylar. Browser approval endpoint'ine approved=true gönderir. Server aynı payload'i tekrar normalize ederek fingerprint üretir.

## Faz 3: Ticket
Server rastgele 48 hex karakterlik ticket üretir. Ticket yalnız server memory Map'te tutulur. Expire zamanı iki dakikadır. Aynı anda en fazla 1000 ticket tutulabilir.

## Faz 4: Consume
Write request action + ticket + payload ile gelir. Server ticket'i bulur, süresini kontrol eder, action/repository/fingerprint eşleşmesini doğrular ve ticket'i tüketir.

## Faz 5: GitHub
Sadece consume başarılıysa GitHub API çağrısı yapılır. Branch, file commit ve PR action'ları kendi doğrulamalarını tekrar uygular.

## Kullanıcı değişikliği
Approval sonrası payload değişirse fingerprint eşleşmez ve write gerçekleşmez. Böylece görünen plan ile gerçek write arasında kullanıcıdan habersiz sapma engellenir.

## Replay
Başarılı veya başarısız tüketimden sonra ticket tekrar kullanılamaz. Restart ile tüm pending ticket'lar da kaybolur.

## Kapsam dışı
Merge, force-push, branch delete, workflow değişikliği ve secret yazımı bu modelde bulunmaz.
