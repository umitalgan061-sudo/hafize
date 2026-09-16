# Zamanlanmış Görevler Operasyon Runbook

## Günlük kontrol

`GET /api/schedules/stats` ile planlı, çalışan, tamamlanan, başarısız ve iptal edilmiş görev sayılarını izleyin. `due` değeri sıfırdan sürekli yüksek kalıyorsa worker throughput'u ile üretim hızı arasında backlog oluşuyor demektir.

## Backlog inceleme

Önce `status=scheduled&sort=runAt-asc` ile en eski due kayıtları inceleyin. Ardından `q` ile agent veya görev metnine göre daraltın. Listeleme cursor tabanlı olduğu için bütün backlog'u tek response olarak çekmeyin.

## Kapasite

Store default olarak görev adedine sabit kota koymaz. Buna rağmen encrypted file storage fiziksel dosya boyutuyla sınırlıdır. `HAFIZE_SCHEDULE_STORAGE_MAX_FILE_BYTES` dolmaya yaklaştığında yeni görev yaratma başarısız olabilir; bu durumda storage büyütme veya database/queue tabanlı migration planlanmalıdır.

## Worker ayarları

Worker default olarak 4 concurrent execution ve tick başına bounded batch tüketimi kullanır. Provider throttling veya CPU baskısı görülürse önce concurrency azaltılmalıdır. Backlog büyürken timeout ve lease davranışları doğrulanmadan yalnızca concurrency artırılmamalıdır.

## Failed görevler

`failed` görevler terminaldir. Retry gerekiyorsa schedule ilk oluşturulurken yeterli `maxAttempts` değeri verilmelidir. Sonraki turlarda ayrı bir manuel retry/requeue komutu eklenebilir; bu sürüm yanlışlıkla sessiz retry yapılmasını tercih etmez.

## Lease problemleri

`SCHEDULE_LEASE_BUSY` normal bir distributed contention sinyalidir. Worker bunu execution failure olarak saymaz ve defer ile yeniden schedule eder. Aynı schedule'ın tekrar tekrar lease collision yaşaması Redis sağlık kontrolü gerektirir.

## Storage recovery

Encrypted file restore başarısızsa runtime startup'ı fail eder; bozuk snapshot sessizce boş listeye çevrilmez. Önce son sağlam backup alınmalı, sonra snapshot formatı ve şifreleme anahtarı doğrulanmalıdır.

## Güvenlik olayı

Secret içeren görev metinleri command boundary'de reddedilir. Bir credential yanlışlıkla task metnine girdiyse yalnız schedule'ı iptal etmek yeterli kabul edilmemeli; ilgili credential da rotate edilmelidir.

## Geri alma

Kod rollback ile schedule verisinin rollback'i birbirinden ayrıdır. Feature revert edilse bile durable snapshot korunur. Bu nedenle rollback sırasında kullanıcı görevlerinin otomatik silinmesi beklenmez.
