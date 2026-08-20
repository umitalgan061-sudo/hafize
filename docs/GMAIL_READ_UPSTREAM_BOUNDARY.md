# Gmail read upstream boundary

Hafize'nin aktif Gmail ajan yüzeyi **salt-okunurdur**. Bu sözleşme `gmail_read` aracının cancellation, token ve upstream veri akışı sınırını tanımlar.

## Yetki sınırı

- Aktif operasyonlar yalnız `profile.get`, `message.list` ve `message.get`tir.
- Gmail gönderme, silme, etiket değiştirme veya serbest URL çağrısı bu tool üzerinden yapılamaz.
- `gmail.send` sözleşme dosyalarının repoda bulunması aktif runtime'a send yetkisi vermez.
- Owner kimliği model argümanından alınmaz; authenticate edilmiş principal server-side owner resolver ile eşlenir.
- OAuth access/refresh token değerleri ajan argümanına veya tool sonucuna eklenmez.
- `gmail.readonly` scope yoksa çağrı fail-closed durur.

## Cancellation zinciri

Caller bir `AbortSignal` sağladığında sinyal şu zincirde korunur:

1. authenticated Gmail agent runtime,
2. Gmail read tool boundary,
3. Gmail read client,
4. bounded provider JSON fetch,
5. gerçek Gmail HTTP isteği.

Pre-abort durumunda owner/token/upstream işi başlamadan çağrı durur. Token store erişimi sürerken caller ayrılırsa token döndükten hemen sonra cancellation yeniden kontrol edilir ve Gmail API çağrısı yapılmaz.

## Token refresh sınırı

Google token refresh aynı owner için eşzamanlı çağrılar arasında coalesce edilebilir. Tek bir Gmail read caller'ının abort sinyali bu ortak refresh'i iptal etmez; aksi davranış başka aktif caller'ların kimlik doğrulamasını bozabilir.

Bunun yerine Gmail read client:

- refresh başlamadan cancellation kontrolü yapar,
- shared refresh tamamlanınca cancellation'ı tekrar kontrol eder,
- caller artık aktif değilse ikinci token load veya Gmail upstream egress yapmaz.

Bu nedenle cancellation, yeni Gmail okuma yan etkisini durdurur fakat başka caller'larla paylaşılabilecek refresh lifecycle'ını zorla kesmez.

## Upstream response sınırı

- Gmail request timeout'u bounded kalır; varsayılan 20 saniyedir.
- Response JSON boyutu varsayılan olarak en fazla 2 MiB'dir.
- HTTP rejection, malformed JSON, declared/incremental oversize ve cancellation yollarında response body/reader best-effort kapatılır.
- Cleanup hatası asıl provider hatasını maskelemez.
- Redirect izlenmez (`redirect: error`).
- Access token yalnız `Authorization: Bearer` header'ında server-side kullanılır.
- Provider yanıtında access token'ın kendisi görünürse sonuç ajan katmanına verilmeden reddedilir.

## Hata semantiği

Caller cancellation `GMAIL_READ_FAILED:cancelled` olarak taşınır. Provider timeout, network, HTTP ve response-validation hataları cancellation ile karıştırılmaz. Böylece üst katman kullanıcı iptali ile gerçek bağlantı/provider sorununu ayrı değerlendirebilir.

## Değişmeyen mimari kararlar

Bu sözleşme Gmail send yetkisi eklemez, ajan roster'ını genişletmez ve prompt tabanlı yetkilendirme oluşturmaz. Hafize'nin backend default-deny tool permission modeli, explicit external-write approval şartı, shared trace/task-ledger yaklaşımı ve secret'ların ajan bağlamına girmemesi kuralları değişmez.
