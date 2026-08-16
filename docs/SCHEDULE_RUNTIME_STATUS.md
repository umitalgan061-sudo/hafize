# Zamanlanmış görev runtime durumu

Hafize utility rail içinde görev içeriğini açmadan yalnız zamanlayıcı altyapısının hazır olma durumunu gösterir.

## Gösterilen sinyaller

Kart mevcut `GET /api/health` yanıtındaki dört boolean alanı kullanır:

- `scheduleWorkerConfigured`: arka plan görev motoru çalıştırılabilecek şekilde yapılandırılmış mı?
- `scheduleApiConfigured`: kullanıcı kontrollü schedule HTTP API etkin mi?
- `scheduleStorageDurable`: schedule kaydı kalıcı depolamaya bağlı mı?
- `scheduleLeaseConfigured`: çoklu worker yürütmesi için dağıtık lease koruması etkin mi?

İlk yüklemede tek health isteği yapılır. Sonraki okuma yalnız kullanıcı **Yenile** düğmesine bastığında gerçekleşir; otomatik polling yoktur.

## Güvenlik sınırı

Kart görev adlarını, promptlarını, kullanıcı kimliklerini, bearer tokenlarını, secretları veya ledger ayrıntılarını istemciye taşımaz. Schedule create/update/delete çağrısı yapmaz ve auth kapsamını genişletmez. Gerçek görev yönetimi mevcut server-side authentication + command boundary sözleşmesinde kalır.

## Hata davranışı

Eksik veya boolean olmayan health alanları fail-closed biçimde geçersiz yanıt kabul edilir ve ayrıntı uydurulmadan genel “durum alınamadı” mesajı gösterilir. Bir önceki isteğin controller'ı yeni manuel yenilemede iptal edilir.

## Geri alma

`schedule-runtime-status.js` shell loader/cache listesinden çıkarılabilir. Backend schedule runtime, HTTP API, storage ve worker kodları bu özelliğe bağlı değildir.
