# Model provider server boundary

Bu katman, NVIDIA NIM ana sağlayıcısını ve isteğe bağlı loopback Ollama sağlayıcısını production HTTP server'a bağlamadan önce tek bir güvenli sonuç sözleşmesine indirger.

## Amaç

`local-provider-server-runtime` provider seçimi ve transport işini yapar. `model-provider-server-boundary` ise server katmanının doğrudan provider exception'larına, ham response ayrıntılarına veya farklı cancellation biçimlerine bağımlı kalmasını engeller.

Boundary üç operasyon sunar:

- `listModels({ signal })`
- `complete(payload, { signal, toolsRequired })`
- `stream(payload, { signal, toolsRequired })`

Başarılı sonuçlar provider kimliğini yalnız `nvidia` veya `local` olarak expose eder. Completion sonucu en az bir `assistant` mesajı içermelidir; stream sonucu async iterable olmak zorundadır. Model listesi string, control-character ve duplicate kontrollerinden geçer.

## Güvenlik sözleşmesi

- Pre-aborted istek provider'a ulaşmaz ve `MODEL_PROVIDER_CANCELLED` döner.
- Provider cancellation farklı hata biçimlerinden tek public cancellation koduna normalize edilir.
- Bilinen güvenli provider error code'ları korunur; raw `detail`, path, token, response body veya exception metni public sonuca taşınmaz.
- Bilinmeyen exception `MODEL_PROVIDER_FAILED` olur.
- Provider sonucu `nvidia|local` dışında bir kimlik döndürürse fail-closed olur.
- `toolsRequired` yalnız boolean olabilir; local provider tool-required çağrıları mevcut router tarafından reddedilmeye devam eder.
- Bu katman agent/tool permission vermez, secret almaz ve model sağlayıcısından authorization türetmez.

## Production wiring sınırı

Bu PR `server.mjs` davranışını değiştirmez. Sonraki wiring adımı mevcut `/api/models` ve chat/agent provider çağrılarını bu boundary üzerinden geçirerek küçük tutulmalıdır. SSE response framing ve agent tool authorization mevcut server katmanında kalır; provider boundary bunları sahiplenmez.

NVIDIA NIM varsayılan/ana sağlayıcı olarak korunur. Local/Ollama yalnız mevcut explicit opt-in ve loopback-only yapılandırma sözleşmesiyle kullanılabilir.
