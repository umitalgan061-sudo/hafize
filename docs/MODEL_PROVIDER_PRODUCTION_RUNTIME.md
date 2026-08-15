# Model provider production runtime

Bu katman NVIDIA NIM'i Hafize'nin ana/varsayılan model sağlayıcısı olarak korurken isteğe bağlı local/Ollama sağlayıcısını production server için tek composition sınırında birleştirir.

## Sözleşme

`createModelProviderProductionRuntime()` üç public işlem sunar: model listesi, completion ve stream. Sonuçlar doğrudan provider cevabı değildir; mevcut `model-provider-server-boundary` üzerinden sanitize edilmiş `{ok,status,...}` sözleşmesine dönüştürülür.

NVIDIA için `NVIDIA_API_KEY` yalnız server-side `Authorization` header'ına girer. Runtime API key'i, raw response body'yi veya provider exception ayrıntısını public sonuçlara eklemez. `NIM_BASE_URL` yalnız HTTPS kabul eder; URL credential, query ve fragment reddedilir.

Local provider yalnız `HAFIZE_LOCAL_PROVIDER_ENABLED=true` ile açılır ve mevcut loopback-only Ollama adapter sınırını kullanır. Local isteklerde NVIDIA bearer header'ı kullanılmaz. `local:` model prefix'i local routing seçer; diğer modeller varsayılan olarak NVIDIA'ya gider.

## Tool güvenliği

Model sağlayıcısı authorization kaynağı değildir. `toolsRequired:true` local provider için fail-closed kalır. Agent tool allow/deny/approval kararı ayrı backend tool-policy katmanındadır.

## NVIDIA ana sağlayıcı davranışı

NVIDIA key yoksa NVIDIA completion 503 `NVIDIA_NOT_CONFIGURED` üretir. Model discovery ise local provider açıksa local modellerin yine listelenebilmesi için NVIDIA listesini boş kabul edebilir. Böylece local provider opsiyoneldir; NVIDIA seçili bir çağrı hiçbir zaman sessizce local modele düşmez.

## Production wiring sınırı

Bu PR `server.mjs`i değiştirmez. Sonraki production wiring, server'ın mevcut NVIDIA model-list/stream çağrılarını bu runtime'ın `listModels` ve `stream` sınırına dar biçimde yönlendirmelidir. Agent/tool execution ayrı tutulmalı; local provider tool desteği açılmadan agent tool akışı local modele geçirilmemelidir.

## Güvenlik

- secret istemciye veya ajan bağlamına verilmez;
- NVIDIA URL'si HTTPS-only ve credential-free'dir;
- Ollama loopback-only sınırı korunur;
- shell/terminal yürütme eklenmez;
- provider hataları sanitize edilir;
- cancellation mevcut boundary üzerinden tek public hata biçimine iner;
- `.env` ve `.github/workflows` değiştirilmez.

## Failure matrisi

Production server bu runtime'ın public sonucunu kullanırken provider exception nesnesine bakmamalıdır. Beklenen üst seviye davranışlar:

- NVIDIA seçili ama key yok: `503 NVIDIA_NOT_CONFIGURED`;
- local model seçili ama local provider kapalı: `503 LOCAL_PROVIDER_NOT_ENABLED`;
- local model tool-required akışta: `400 LOCAL_PROVIDER_TOOLS_UNSUPPORTED`;
- iptal edilmiş istek: `499 MODEL_PROVIDER_CANCELLED`;
- NVIDIA HTTP/provider hatası: sanitize edilmiş `NVIDIA_CHAT_ERROR`;
- bozuk NVIDIA JSON: `INVALID_NVIDIA_RESPONSE`;
- bozuk provider stream: `INVALID_PROVIDER_STREAM`.

HTTP katmanı bu kodları kullanıcıya güvenli biçimde aktarabilir; raw provider body, stack veya credential eklememelidir.

## Sonraki dar wiring

`server.mjs` güncellenirken mevcut scheduler ve screen-analysis NVIDIA-only davranışı bilinçli olarak korunmalıdır. Local provider masaüstü/interactive chat seçeneğidir; 7×24 cloud worker'ın localhost Ollama'ya erişebileceği varsayılmamalıdır. İlk production wiring yalnız `/api/models` ve düz `/api/chat` için yapılmalıdır. Agent tool akışı, local tool desteği ve ayrı regresyonlar hazır olmadan local modele yönlendirilmemelidir.

## Health yüzeyi

Server health yalnız boolean capability yayımlamalıdır: `nvidiaConfigured` ve `localProviderConfigured`. Base URL, model listesi, API key varlığı dışındaki secret metadata, token uzunluğu veya provider hata ayrıntısı health response'a konmamalıdır. Local provider kapalıyken mevcut NVIDIA health davranışı değişmemelidir.
