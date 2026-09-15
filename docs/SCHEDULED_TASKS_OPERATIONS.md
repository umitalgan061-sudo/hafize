# Zamanlanmış Görevler — Operasyon ve Runbook

## Kapsam

Bu runbook, kullanıcı arayüzü ile mevcut schedule storage, worker, execution ve HTTP API katmanının birlikte işletilmesi içindir.

## Başlangıç kontrolü

Production ortamında `HAFIZE_SCHEDULE_AUTH_TOKEN` tanımlı olmalıdır.

Schedule auth subject gerekiyorsa `HAFIZE_SCHEDULE_AUTH_SUBJECT` yapılandırılmalıdır.

Worker için `HAFIZE_SCHEDULE_MODEL` seçili olmalıdır.

`HAFIZE_SCHEDULE_TICK_MS` 5 saniye ile 5 dakika arasında bounded edilir.

`HAFIZE_SCHEDULE_RUN_TIMEOUT_MS` 10 saniye ile 5 dakika arasında bounded edilir.

Durable schedule storage kullanılıyorsa şifreleme config'i geçerli olmalıdır.

## UI erişimi

Kullanıcı oturumu açıkken sol menüde Görevler öğesi açılabilir.

Ajan seçimi ana ajan registry'sinden gelir.

Görev oluşturma formu POST çağrısı yapar.

Liste GET çağrısı yapar.

İptal DELETE çağrısı yapar.

## Sağlık kontrolü

Görev paneli açıldığında liste yüklenemiyorsa önce 401 ile 5xx ayrımı yapılmalıdır.

401 authentication sorunudur.

503 kapasite veya altyapı sınırı olabilir.

502 veya 500 benzeri generic failure UI'da görev servisine ulaşılamadığı şeklinde görünür.

## Durum inceleme

Planlandı kayıtlar gelecekte çalışması beklenen işlerdir.

Çalışıyor kayıtlar worker tarafından claim edilmiş işlerdir.

Tamamlandı kayıtlar yürütülmüş işlerdir.

Başarısız kayıtlar son yürütmenin başarısız olduğunu gösterir.

İptal edildi kayıtlar kullanıcı tarafından cancel edilmiş işlerdir.

## İptal incelemesi

İptal yalnızca `scheduled` state için geçerlidir.

Running kayıtta iptal görünmemesi beklenen davranıştır.

409 response alınırsa backend state'in değiştiği varsayılır ve UI listeyi yeniler.

## Capacity

Store kapasite hatası `SCHEDULE_CAPACITY_REACHED` olarak UI'ya aktarılır.

Kapasite problemi bir frontend validation problemi değildir.

Operasyon ekibi schedule store kapasitesini, retention yaklaşımını ve eski kayıt temizleme politikasını ayrı backend operasyonu olarak değerlendirmelidir.

UI otomatik silme yapmaz.

## Worker gecikmesi

Görev zamanı geçmiş olsa bile worker tick gecikmesi mümkün olabilir.

UI `runAt` değerini gösterir, worker'ın gerçek claim zamanını taklit etmez.

Çalışıyor state'i scheduler tarafından belirlendiğinde kullanıcıya yansıtılır.

## Model hatası

Yürütme sırasında model veya tool kaynaklı hata oluşursa schedule runtime kendi retry politikasına göre davranır.

UI retry mekanizmasını yeniden uygulamaz.

Failed kayıt içinde `lastError` varsa yalnızca bounded metin gösterilir.

## Trace ID ile inceleme

Support, schedule kaydındaki Trace ID ile server loglarında ilgili yürütmeyi arayabilir.

Client Trace ID üretmez.

Client Trace ID'yi değiştiremez.

## Offline / PWA

Offline shell çalışabilir.

API çağrıları network-only'dir.

Offline durumda eski schedule state'i gösterilmemelidir.

Kullanıcı bağlantı geldiğinde Yenile ile server snapshot'ını alabilir.

## Deploy sonrası

Yeni static asset eklendiğinde service worker cache version artırılmalıdır.

Shell listesinde CSS ve JS asset'lerinin ikisi de bulunmalıdır.

`/api/` network-only kuralı korunmalıdır.

Eski cache temizleme davranışı `CACHE_PREFIX` altında sürdürülmelidir.

## Rollback

Kod rollback için PR revert tercih edilir.

Server schedule verisi silinmez.

UI asset rollback sonrasında eski shell cache'in etkin olmaması için yeni/uygun service worker sürümü kontrol edilmelidir.

Database veya encrypted file storage rollback'un parçası olarak silinmemelidir.

## Olay yönetimi

Kimlik doğrulama sorunu varsa auth katmanı incelenir.

Ajan bulunamıyorsa registry yükleme incelenir.

Capacity hatasında store/runtime kapasitesi incelenir.

Execution failure'da worker, model ve tool boundary logları incelenir.

Storage startup failure'da durable storage configuration incelenir.

## Kullanıcı desteği

Kullanıcıdan secret veya bearer token istemeyin.

Kullanıcıdan yalnızca görev adı, seçilen zaman ve görünen hata metni istenebilir.

Trace ID destek için paylaşılabilir; auth token paylaşılmamalıdır.

## İzlenebilirlik

Server-side trace ve execution ledger mevcutsa schedule ID ile birlikte kullanılır.

Bu UI özelinde client analytics eklenmez.

## Operasyon kabul kriterleri

Planlama API'si authenticated olmalı.

Liste ownership filtreli olmalı.

Cancel sadece planlı state'de mümkün olmalı.

API cache'lenmemeli.

Static asset'ler PWA shell'de bulunmalı.

UI generic failure halinde çökmemeli.
