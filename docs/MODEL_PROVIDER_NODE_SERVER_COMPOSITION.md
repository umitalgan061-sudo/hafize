# Model provider Node server composition

Bu katman opt-in local/Ollama provider zincirini production `server.mjs`e bağlamadan önce son composition sınırını tanımlar.

## Amaç

`createModelProviderNodeServerRuntime()` aynı production provider instance'ını şu akışların tamamında kullanır:

1. NVIDIA/local model discovery ve chat streaming.
2. `local:` model için provider-aware context compaction completion çağrısı.
3. Agent registry tabanlı güvenli chat preparation.
4. HTTP contract ve Node `ServerResponse` bridge'i.

Böylece local context özetleme ayrı bir provider instance'ı veya NVIDIA fallback üzerinden sessizce yürütülemez.

## Güvenlik sınırı

- NVIDIA varsayılan provider olmaya devam eder.
- Local provider yalnız mevcut explicit env opt-in ve loopback-only adapter kurallarıyla açılır.
- Provider seçimi tool authorization değildir.
- Basit `/api/chat` provider yolu tool calling açmaz.
- Local context compactor `supportsLocalModels: true` taşımak zorundadır.
- Aynı `provider.complete` referansı local summarizer'a bağlanır.
- Secret, bearer token, raw provider/fetch nesnesi veya completion fonksiyonu public runtime yüzeyine çıkmaz.
- Node route cancellation, response header güvenliği ve stream sanitization mevcut bridge tarafından korunur.
- Agent registry ve backend default-deny permission sözleşmesi değiştirilmez.

## Public runtime yüzeyi

Composition yalnız şu bilgileri dışarı verir:

- `nvidiaConfigured`
- `localConfigured`
- `defaultProvider`
- `contextCompactionConfigured`
- `handle`

Provider nesnesi ve credential taşıyan runtime ayrıntıları private closure içinde kalır.

## Production wiring sınırı

Bu PR `server.mjs`i değiştirmez. Sonraki production adımı yalnız bu composition'ı mevcut registry, base context compactor, JSON reader/writer ve security-header fonksiyonlarıyla oluşturmalı; `/api/models` ve basit `/api/chat` yollarını `handle()` üzerinden yönlendirmelidir.

`/api/agent/run`, scheduler ve screen-analysis mevcut NVIDIA-only/tool-policy davranışını korumalıdır. Health yalnız boolean provider capability bilgisi yayınlamalı; model endpoint, base URL veya secret yayınlamamalıdır.
