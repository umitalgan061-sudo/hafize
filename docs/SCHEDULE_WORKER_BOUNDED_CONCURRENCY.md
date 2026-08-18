# Schedule worker bounded concurrency

## Amaç

Hafize zamanlanmış görev worker'ı bir tick sırasında sınırsız sayıda due görevi `running` durumuna çekmemeli ve bunların tamamını aynı anda model/provider çalıştırmasına sokmamalıdır. Bu sözleşme bulut worker'ı için bounded claim ve bounded execution davranışını tanımlar.

## Varsayılanlar

- Bir tick en fazla **8** due görevi claim eder.
- Aynı process içinde bu batch'ten en fazla **2** görev eşzamanlı execute edilir.
- Yapılandırılabilir batch üst sınırı **64**.
- Yapılandırılabilir execution concurrency üst sınırı **8**.
- `runDue({ limit })`, configured batch limitini genişletemez; yalnız daha küçük bir tek-tick limiti isteyebilir.

Bu değerler NVIDIA NIM veya başka bir provider'ın kapasite garantisi değildir. Amaç worker'ın kendi başına kontrolsüz fan-out üretmemesidir.

## Neden claim de bounded?

Yalnız execution concurrency'yi sınırlamak yeterli değildir. Store bütün due kayıtları önce `running` durumuna geçirip sonra worker kuyruğunda bekletseydi process crash durumunda fiilen çalışmaya hiç başlamamış çok sayıda kayıt `running` kalabilirdi. Claim batch'in de bounded olması bu crash yüzeyini daraltır.

## Sıralama

Store `claimDue()` kayıtları `runAt`, ardından `scheduleId` sırasıyla döndürür. Worker bounded lane'lerde paralel çalıştırsa da sonuç dizisini claim sırasıyla korur. Böylece log/test tüketicileri completion zamanına bağlı nondeterministic sıralama görmez.

## Failure davranışı

Bir görevin provider/agent execution'ı throw ederse hata ayrıntısı public worker sonucuna kopyalanmaz; mevcut `SCHEDULE_EXECUTION_FAILED` sözleşmesi kullanılır. Retry hakkı varsa mevcut retry policy çalışır. Bilinmeyen agent mevcut `SCHEDULE_AGENT_NOT_FOUND` davranışını korur.

Store configured claim limitinden fazla kayıt döndürürse worker execution başlamadan `INVALID_SCHEDULE_WORKER:claim_limit_exceeded` ile fail-closed durur. Claim sonucu array değilse `INVALID_SCHEDULE_WORKER:claimed` üretilir.

## Güvenlik ve izin sınırı

Bu değişiklik yalnız scheduling kaynak kullanımını sınırlar.

- Agent registry değişmez; aktif roster iki selector + iki specialist olmak üzere dört profildir.
- Tool permission modeli backend default-deny kalır.
- Dış write/send/merge eylemleri mevcut explicit approval sınırlarını korur.
- Provider/model seçimi yeni tool yetkisi oluşturmaz.
- Secret veya credential worker context'ine eklenmez.
- Yeni endpoint, shell/exec/spawn, client storage veya otomatik persistent memory write eklenmez.

## Multi-instance davranışı

Bu sınır process başınadır. Birden fazla Hafize instance'ı çalışıyorsa Redis schedule lease katmanı aynı schedule'ın eşzamanlı execution'ını önlemeye devam eder; ancak toplam provider concurrency instance sayısıyla büyüyebilir. Cluster-wide provider semaphore ayrı bir mimari karardır ve bu sözleşmenin kapsamı değildir.

## Geri alma

`lib/schedule-worker.mjs` içindeki bounded batch/concurrency policy ve bu özelliğe ait testler kaldırılarak eski unlimited `Promise.all` davranışına dönülebilir. Schedule kayıt şeması, API payload'ları veya kalıcı veri formatında migration yoktur.
