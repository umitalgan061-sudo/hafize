# Google OAuth upstream lifecycle sınırı

Bu belge Hafize'nin Google OAuth authorization-code exchange ve bağlantı kesme/revoke akışlarında provider isteği, cancellation ve credential persistence arasındaki güvenlik sözleşmesini tanımlar.

## Kapsam

Bu sınır yalnız Hafize'nin kendi Google OAuth runtime'ı için geçerlidir.

- Google token endpoint'i: authorization-code exchange.
- Google revoke endpoint'i: açık kullanıcı niyetli bağlantı kesme.
- Server-side OAuth token store.
- Ortak bounded provider JSON reader.

Gmail mesaj gönderme, agent tool approval veya başka connector yazmaları bu sözleşmenin kapsamı değildir ve kendi approval sınırlarını korur.

## Değişmeyen güvenlik ilkeleri

- OAuth client secret yalnız backend ortamında kalır.
- Secret veya refresh token ajan bağlamına sokulmaz.
- Google OAuth scope seti exchange sırasında genişleyemez.
- Disconnect açık `explicitUserIntent: true` olmadan çalışmaz.
- Credential silme provider sonucundan önce yapılmaz.
- Provider isteklerinde redirect takibi kapalıdır (`redirect: error`).
- Token JSON yanıtı bounded okunur; Google exchange için sınır 64 KiB'dir.
- Upstream istekleri bounded timeout kullanır; varsayılan 15 saniyedir.

## Parent cancellation

`fetchBoundedProviderJson` isteğe bağlı bir parent `AbortSignal` kabul eder.

Kurallar:

1. Signal çağrı başlamadan abort edilmişse provider network isteği hiç başlatılmaz.
2. Parent signal provider fetch sürerken abort edilirse gerçek upstream `fetch` AbortController üzerinden iptal edilir.
3. Parent cancellation, deadline timeout'tan ayrı bir hata sınıfıdır.
4. Timeout `*:timeout`, parent cancellation `*:cancelled` olarak raporlanır.
5. Parent abort listener'ı success, failure, timeout ve cancellation yollarının tamamında kaldırılır.
6. Timer her terminal durumda temizlenir.
7. Caller signal yoksa önceki bounded-timeout davranışı aynen devam eder.

Bu ayrım önemlidir: ağ sağlayıcısının yavaş olması ile kullanıcı/üst runtime'ın artık sonuca ihtiyaç duymaması aynı hata değildir.

## Authorization-code exchange persistence sınırı

Authorization code hassas ve tek kullanımlık bir geçiştir. Hafize aşağıdaki sırayı uygular:

1. owner, PKCE verifier, redirect URI ve expected scope doğrulanır;
2. cancellation kontrol edilir;
3. bounded Google token request başlatılır;
4. provider payload ve scope seti doğrulanır;
5. gerekiyorsa mevcut refresh token server-side store'dan okunur;
6. cancellation tekrar doğrulanır;
7. ancak bundan sonra yeni credential kaydı yazılır.

Cancellation provider yanıtı geldikten sonra fakat credential persistence başlamadan oluşursa Hafize yeni token kaydını yazmaz. Böyle bir durumda authorization code provider tarafından tüketilmiş olabilir; kullanıcı yeniden OAuth bağlantısı başlatabilir. Hafize bunu sessiz kalıcı credential yazımına tercih eder.

Token store yazımı başladıktan sonraki storage atomikliği token-store sözleşmesinin sorumluluğundadır; cancellation yarım storage write üretmek için kullanılmaz.

## Revoke outcome sınırı

Revoke, exchange'den farklıdır çünkü uzak sistemde geri alınamaz bir credential geçersizleştirme yan etkisi vardır.

### Provider sonucu henüz kesin değilse

Parent cancellation veya timeout gerçek revoke sonucu doğrulanmadan meydana gelirse:

- local credential silinmez;
- sonuç başarılı disconnect olarak raporlanmaz;
- kör otomatik retry yapılmaz;
- bir sonraki kullanıcı işlemi provider/local durumu yeniden değerlendirmelidir.

Bu yaklaşım, belirsiz bir uzak yan etki sonrasında yerel kaydı yanlışlıkla silmeyi önler.

### Provider sonucu kesinleştiyse

Google aşağıdaki sonuçlardan birini doğruladığında bağlantı provider açısından kesin olarak kullanılamaz kabul edilir:

- HTTP 200 revoke success;
- bounded HTTP 400 payload içinde exact `invalid_token` sonucu.

Bu noktadan sonra local credential silme işlemi tamamlanır. Caller signal hemen ardından abort edilse bile local kaydın tutulması doğru değildir; provider tarafından geçersiz olduğu doğrulanmış credential'ı "bağlı" gibi saklamak yanıltıcı state üretir.

## Response-body cleanup

Rejected veya artık okunmayacak provider response body'leri best-effort kapatılır.

- Non-2xx bounded JSON response body kapatılır.
- Declared byte sınırını aşan JSON body okunmadan kapatılır.
- Revoke HTTP 200 body kullanılmayacağı için kapatılır.
- Revoke failure body doğrulama için gerekli değilse kapatılır.
- `invalid_token` doğrulaması için gereken bounded 400 body okunur ve reader lock bırakılır.
- Cleanup hatası asıl provider hatasını maskelemez.

Amaç yalnız kaynak tasarrufu değildir; bağlantı havuzunda yarım response bırakmamak ve uzun ömürlü Hafize server process'inde upstream lifecycle'ı deterministik tutmaktır.

## Fail-closed durumları

Aşağıdaki durumlarda credential persistence/deletion ilerlemez:

- malformed AbortSignal sözleşmesi;
- pre-aborted exchange/revoke;
- provider network failure;
- provider timeout;
- provider response byte sınırı ihlali;
- malformed token response;
- scope escalation;
- revoke sonucunun doğrulanamaması.

Exception: provider revoke sonucu kesin başarı/`invalid_token` olarak doğrulandıktan sonra local delete caller cancellation nedeniyle geri alınmaz.

## Test sözleşmesi

Regresyon testleri en az şu davranışları pinler:

- pre-abort provider egress'i engeller;
- parent abort gerçek fetch signal'ını abort eder;
- timeout cancellation'dan ayrı kalır;
- abort listener/timer terminal durumda temizlenir;
- rejected/oversized response body kapatılır;
- cancelled exchange token store'a yazmaz;
- fallback refresh-token load sırasında cancellation save'i engeller;
- belirsiz cancelled revoke local credential'ı korur;
- doğrulanmış revoke local credential'ı siler;
- provider failure local credential'ı silmez;
- explicit user intent şartı değişmez.

## Sonraki entegrasyon kuralı

Yeni Google/Gmail OAuth HTTP adapter'ı veya background refresh consumer'ı bu token fonksiyonlarına kendi güvenilir lifecycle signal'ını taşıyabilir. Signal üretimi adapter'ın sorumluluğundadır; rastgele request field'ı veya model çıktısı AbortSignal olarak kabul edilmez.

Shared refresh gibi birden fazla caller'ın aynı provider isteğini kullandığı yapılarda tek caller cancellation'ı ortak refresh'i iptal etmemelidir. Böyle bir entegrasyon yapılacaksa owner-scoped inflight/lease semantiği ayrıca korunmalıdır.
