# Local provider server runtime

Bu katman, Hafize'nin NVIDIA NIM ana sağlayıcısını korurken isteğe bağlı loopback Ollama sağlayıcısını production server'a bağlamadan önce tek bir backend composition sınırında toplar.

## Amaç

`lib/local-provider-server-runtime.mjs` üç mevcut parçayı birleştirir:

- NVIDIA completion / stream / model-list fonksiyonları,
- `createLocalOllamaProvider()` loopback adaptörü,
- `createModelProviderRouter()` sağlayıcı seçimi.

Bu modül HTTP route açmaz, `server.mjs`i değiştirmez ve modele yeni tool yetkisi vermez. Amaç bir sonraki production wiring değişikliğini birkaç açık çağrı noktasına indirgemek ve env doğrulamasını ayrı test edilebilir hale getirmektir.

## Yapılandırma

Yalnız iki environment değeri tanınır:

- `HAFIZE_LOCAL_PROVIDER_ENABLED=true|false`
- `HAFIZE_LOCAL_PROVIDER_BASE_URL=http://localhost:11434/v1`

Local provider varsayılan olarak kapalıdır. Enable değeri yalnız exact `true` veya `false` kabul eder; `1`, `yes` gibi belirsiz değerler startup'ta fail-closed reddedilir.

Özel base URL verilmişse local provider açık olmalıdır. Base URL'nin loopback-only, HTTP-only ve credential içermeyen ayrıntılı doğrulaması mevcut `local-ollama-provider` boundary'sinde kalır. Runtime yeni API key, token, password veya secret alanı tanımlamaz.

## Sağlayıcı davranışı

Varsayılan provider her zaman `nvidia` kalır. Model kimliği `local:` ile başlıyorsa ve local provider açık/configured ise router local provider'ı seçebilir. Normal model kimlikleri NVIDIA yolunda kalır.

Runtime şu dört backend operasyonunu expose eder:

- `complete()`
- `stream()`
- `listModels()`
- `resolve()`

`listModels()` NVIDIA modellerini temel liste olarak korur ve local provider açıksa `local:<model>` kimliklerini ekler. Local model discovery hatası NVIDIA listesini bozmaz.

## Tool permission sınırı

Model sağlayıcısı authorization kaynağı değildir. Local provider seçmek agent registry veya tool policy'yi değiştirmez. Router'daki `toolsRequired:true` kapısı local provider için fail-closed kalır; böylece mevcut NVIDIA tool-calling akışı local modele sessizce taşınmaz.

Yeni runtime `lib/tool-runtime.mjs` veya `agents/registry.json` üzerinde hiçbir değişiklik gerektirmez. External write/send/merge onayı ve backend default-deny sözleşmesi aynen korunur.

## Ağ ve secret sınırı

Local provider adapter yalnız loopback hedefe bağlanabilir. Runtime:

- Authorization header üretmez,
- API key/token env'i okumaz,
- LAN/public host'u açmaz,
- shell/terminal çalıştırmaz,
- provider response hata gövdesini yeni bir public kanala taşımaz.

NVIDIA credential yaşam döngüsü mevcut NVIDIA backend fonksiyonlarında kalır ve local runtime'a verilmez.

## Production wiring için sonraki adım

Bir sonraki güvenli adım `server.mjs` içinde bu runtime'ı compose edip yalnız mevcut provider çağrı noktalarını router'a geçirmek olmalıdır:

1. `/api/models` model discovery,
2. düz `/api/chat` streaming,
3. tool'suz completion yolları,
4. health'te yalnız `localProviderConfigured:boolean` capability bilgisi.

Tool çağrılı agent akışı local modele geçirilmemelidir; router'ın `toolsRequired` kapısı korunmalıdır. Scheduled agent ve context summarizer gibi NVIDIA'ya özel mevcut yollar, ayrıca test edilmeden local provider'a yönlendirilmemelidir.

## Test sözleşmesi

Canonical `scripts/test-*.mjs` discovery altında iki test bu boundary'yi korur:

- `test-local-provider-server-runtime.mjs`: strict env, disabled/no-network, NVIDIA default, local completion/stream/model discovery, signal propagation ve tool fail-closed davranışı.
- `test-local-provider-server-source-isolation.mjs`: credential/shell yüzeyi yokluğu ve production server/tool/registry izolasyonu.

Bu tasarım NVIDIA'yı ana sağlayıcı tutar ve local provider'ı açık, sınırlı ve geri alınabilir bir opt-in capability olarak hazırlar.
