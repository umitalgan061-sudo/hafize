# Zamanlanmış Görevler — Support Guide

## Kullanıcı görevi planlayamıyor

Önce kullanıcı oturumunun açık olduğunu doğrulayın.

Sonra Görevler panelini yeniden açın.

Ajan listesinin dolduğunu kontrol edin.

Task metninin boş olmadığını kontrol edin.

Çalıştırma zamanının gelecekte olduğunu kontrol edin.

## Kullanıcı görevi göremiyor

Panel açılışında GET `/api/schedules` çağrısının başarılı olup olmadığını kontrol edin.

401 ise authentication sorunudur.

5xx ise server schedule runtime incelenir.

Offline durumda API listesi görülemez.

## Kullanıcı görevi iptal edemiyor

Görevin status değerini kontrol edin.

Running, completed, failed veya cancelled kayıtlar cancel edilemez.

Scheduled kayıtta cancel görünmelidir.

409 dönerse worker ile kullanıcı işlemi arasında yarış yaşanmış olabilir.

## Kullanıcı görev gecikmesini bildiriyor

Görevin `runAt` değerini kontrol edin.

Worker tick ve lease runtime'ı kontrol edin.

Task'ın running olup olmadığını kontrol edin.

Client countdown yalnızca zaman farkını gösterir; worker çalışmasını garanti etmez.

## Kullanıcı başarısız görev bildiriyor

UI'daki lastError alanını alın.

Trace ID'yi not edin.

Server execution logs'u inceleyin.

Model ve tool runtime sınırlarını kontrol edin.

Client tarafında tekrar deneme oluşturmayın.

## Capacity hatası

503 `SCHEDULE_CAPACITY_REACHED` kullanıcıya gösterilir.

Kayıtları client üzerinden toplu silmeyin.

Store capacity ve retention operasyonunu inceleyin.

## Güvenlik bildirimi

Kullanıcıdan schedule auth token istemeyin.

Kullanıcıdan NVIDIA API key istemeyin.

Task metni içindeki secret'ı support ticket'ına kopyalamayın.

Gerekirse task text yerine yalnızca hata kodu ve Trace ID alın.

## Privacy

UI analytics göndermediği için kullanıcı görevlerini üçüncü taraf dashboard'larda aramayın.

Schedule task content server-side execution için gereklidir.

## Browser issue

Problem tek browser'da ise browser matrix kontrolü yapın.

Mobilde viewport ve virtual keyboard kontrol edin.

Forced colors veya reduced motion açıkken CSS varyantını kontrol edin.

## PWA issue

Önce service worker cache version'ını kontrol edin.

Stale client asset varsa yeni cache version'ın geldiğini doğrulayın.

Schedule API response'unun cache'ten gelmediğini doğrulayın.

## Support response principles

Kesin bilinmeyen server state tahmin edilmemelidir.

Kullanıcıya “task kesin çalışacak” garantisi verilmez.

UI status server snapshot'ını yansıtır.

## Incident escalation

Authentication incident -> auth owner.

Schedule storage incident -> schedule storage owner.

Worker incident -> execution/worker owner.

Model incident -> model runtime owner.

Security incident -> security owner.

## Rollback communication

Rollback client UI'yi etkileyebilir ancak server schedule kayıtlarının otomatik silindiği varsayılmamalıdır.

## Completion criteria

Kullanıcı görevi planlayabiliyor.

Görevi görebiliyor.

Planlı görevi iptal edebiliyor.

Status değişimini anlayabiliyor.

Hata mesajını anlayabiliyor.

Support güvenli veri topluyor.
