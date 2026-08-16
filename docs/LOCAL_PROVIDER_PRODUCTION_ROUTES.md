# Local provider production routes

Bu sözleşme Hafize'nin NVIDIA NIM'i ana sağlayıcı olarak korurken isteğe bağlı local/Ollama inference'ı production HTTP yüzeyine nasıl açtığını tanımlar.

## Açılan yüzey

Yalnız iki mevcut endpoint provider-aware hale gelir:

- `GET /api/models` — NVIDIA modellerini ve local provider açık ise `local:` prefix'li yerel modelleri listeler.
- `POST /api/chat` — basit, tools kapalı streaming sohbet yoludur. `local:<model>` seçilirse loopback local provider'a, diğer modeller NVIDIA'ya gider.

Bu iki endpoint tek `createModelProviderNodeServerRuntime()` instance'ına bağlanır. Aynı runtime model discovery, streaming ve provider-aware local context compaction için aynı provider instance'ını kullanır.

## NVIDIA-only kalan yollar

Bu değişiklik provider seçimini tool yetkisine dönüştürmez. Aşağıdaki yollar bilinçli olarak NVIDIA NIM üzerinde kalır:

- `/api/agent/run` tool calling ve delegasyon akışı;
- scheduled-agent execution;
- screen analysis;
- mevcut NVIDIA-backed privileged/delegated completion zinciri.

Böylece `local:` model seçmek `repo.write`, merge, connector send veya başka bir dış yan etki izni sağlamaz. Agent/tool authorization hâlâ backend registry ve default-deny enforcement tarafından belirlenir.

## Local provider opt-in

Local provider varsayılan olarak kapalıdır. Yalnız server-side ortam yapılandırmasıyla açılır:

- `HAFIZE_LOCAL_PROVIDER_ENABLED=true`
- isteğe bağlı `HAFIZE_LOCAL_PROVIDER_BASE_URL`

Base URL mevcut adapter sözleşmesinde yalnız HTTP loopback (`localhost`, `127.0.0.1`, `::1`) olabilir. URL credential, public/LAN host, query ve fragment kabul edilmez. Local provider için API key veya password env alanı eklenmez.

## Context gizliliği

Uzun `local:` konuşmalar NVIDIA summarizer'a sessizce gönderilmez. Production runtime aynı local provider instance'ını provider-aware compactor'a bağlar. Local summary `toolsRequired:false` ile çalışır; local summary başarısızsa NVIDIA'ya otomatik fallback yapılmaz.

## Health görünürlüğü

`/api/health` yalnız güvenli capability metadatası yayınlar:

- `nvidiaConfigured`
- `localProviderConfigured`
- `defaultModelProvider`
- `contextCompactionConfigured`

Local base URL, NVIDIA endpoint'i, bearer token, API key veya başka secret health cevabına girmez.

## Cancellation ve hata sınırı

Node route response kapanmasını `AbortSignal` olarak provider'a taşır. Provider/stream hataları sanitize edilir; raw upstream response, path veya credential istemciye yansıtılmaz.

## Geri alma

Production route wiring'i geri alınırsa önceki NVIDIA-only `/api/models` ve `/api/chat` davranışı geri gelir. Local provider adapter/composition katmanları bağımsız kaldığı için persistent veri migrasyonu veya credential dönüşümü gerekmez.
