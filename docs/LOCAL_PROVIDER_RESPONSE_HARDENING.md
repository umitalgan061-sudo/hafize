# Local provider response hardening

Hafize'nin isteğe bağlı `local:` sağlayıcısı NVIDIA NIM'in yerini almaz. Varsayılan sağlayıcı NVIDIA'dır; local/Ollama ancak `HAFIZE_LOCAL_PROVIDER_ENABLED=true` ile açılır ve yalnız `http://localhost`, `http://127.0.0.1` veya `http://[::1]` taban URL'lerine bağlanabilir.

Bu sözleşme local provider'dan gelen veriyi güvenilir kabul etmez. Loopback'te çalışan başka bir süreç, yanlış yapılandırılmış proxy veya bozuk Ollama-compatible servis de saldırgan/bozuk yanıt üretebilir. Bu nedenle response sınırları istemci girdisi sınırları kadar önemlidir.

## Ağ sınırı

Local provider istekleri redirect takip etmez (`redirect: error`). Base URL kullanıcı adı/parola, query veya fragment içeremez ve yalnız HTTP loopback hostlarına izin verilir. Hafize bu yolda bearer token, cookie, connector credential veya başka bir secret eklemez.

JSON completion ve model-listesi endpoint'leri yalnız `application/json` kabul eder. Streaming completion yalnız `text/event-stream` kabul eder. Yanlış veya eksik media type fail-closed davranır; model discovery'de bu hata güvenli biçimde boş listeye düşer.

## Boyut ve süre sınırları

- Completion JSON: en fazla 4 MiB.
- Model-listesi JSON: en fazla 1 MiB.
- Tek streaming chunk: en fazla 512 KiB.
- Bir streaming cevabında toplam veri: en fazla 8 MiB.
- JSON completion/model discovery varsayılan deadline: 30 saniye.
- Test/enjeksiyon dahil izin verilen JSON deadline üst sınırı: 120 saniye.
- Provider model kimliği: en fazla 160 karakter.
- UI'ya dönen local model listesi: en fazla 200 benzersiz model.

`Content-Length` mevcutsa limit daha body okunmadan uygulanır. Streaming body'lerde limit gerçek okunan byte sayısı üzerinden tekrar uygulanır. JSON body'nin byte ölçümü UTF-8 üzerinden yapılır.

## Model kimliği

Local model adları Hafize'de `local:` önekiyle taşınır; provider'a gönderilirken bu önek kaldırılır. Provider model kimliği yalnız ASCII alfanümerik başlangıç ve `A-Z a-z 0-9 . _ : / + -` karakterlerinden oluşabilir. Boş, kontrol karakterli, whitespace içeren, Unicode sürprizleri taşıyan veya 160 karakteri aşan kimlikler reddedilir.

Model discovery duplicate kimlikleri tekilleştirir ve geçersiz kayıtları sessizce atar. Discovery'nin kendisi optional UX olduğundan provider hatası/bozuk yanıt boş liste üretir; fakat kullanıcı tarafından iptal edilmiş istek `LOCAL_PROVIDER_CANCELLED` olarak korunur.

## Abort ve timeout

JSON çağrıları parent AbortSignal'i dahili bounded controller'a bağlar. Parent abort yeni veya sürmekte olan okumayı `LOCAL_PROVIDER_CANCELLED` ile keser. Dahili deadline dolarsa `LOCAL_PROVIDER_TIMEOUT` döner. Timer ve parent abort listener'ı her durumda temizlenir.

Streaming çağrısı kullanıcının/request'in mevcut AbortSignal'ini doğrudan fetch'e taşır. Bu katman retry yapmaz ve farklı sağlayıcıya sessiz fallback gerçekleştirmez.

## Tool permission ayrımı

`local:` model seçimi ajan yetkilerini değiştirmez. Tool allowlist/deny-by-default sözleşmesi `agents/registry.json` ve backend runtime tarafından uygulanmaya devam eder. Model sağlayıcısı prompt içeriğiyle veya provider kimliğiyle yeni tool yetkisi kazanamaz. Dış write/send/merge işlemleri mevcut açık kullanıcı onayı sınırlarını ayrıca geçmek zorundadır.

Bu geliştirme yeni ajan, endpoint, kalıcı storage veya credential mekanizması eklemez. `.env`, `.github/workflows/`, generated/vendor veya credential dosyaları değiştirilmez.

## Regresyon kapsamı

Canonical check suite otomatik olarak aşağıdaki testleri keşfeder:

- `test-local-provider-response-hardening.mjs`: redirect, JSON media type, declared body limiti, timeout, abort ve model-ID sınırları.
- `test-local-provider-stream-bounds.mjs`: SSE media type, per-chunk ve cumulative stream byte limitleri, byte-only stream sözleşmesi.
- `test-local-provider-model-list-safety.mjs`: dedupe, ID allowlist, maksimum model sayısı, bozuk discovery yanıtlarında fail-soft davranış ve explicit abort.
- `test-local-provider-security-contract.mjs`: loopback/redirect/secret/tool-policy/default-provider kaynak sözleşmesi.

Geri alma için yalnız `lib/local-ollama-provider.mjs`, bu belge ve ilgili regresyon testleri revert edilir. Kalıcı veri veya schema migrasyonu yoktur.
