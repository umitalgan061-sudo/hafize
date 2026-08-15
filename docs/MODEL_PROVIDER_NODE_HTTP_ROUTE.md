# Model provider Node HTTP route contract

Bu katman `model-provider-http-server-runtime` ile Node `ServerResponse` arasında dar production köprüsüdür. Amaç provider seçimini veya tool yetkisini burada belirlemek değil; #137'de hazırlanmış sanitize HTTP sonucunu gerçek HTTP response'una güvenli biçimde aktarmaktır.

## Sorumluluk sınırı

`createModelProviderNodeHttpRoute()` yalnız `/api/models` ve `/api/chat` yollarını ele alır. Route dışındaki path'lerde `matched:false` döner. Provider/env/secret okumaz ve kendi başına NVIDIA ya da Ollama client'ı oluşturmaz.

Katman üç dependency alır:

- `runtime.handle` — sanitize model-provider HTTP runtime,
- `sendJson` — mevcut Hafize JSON response yazıcısı,
- `setSecurityHeaders` — mevcut Hafize security-header uygulayıcısı.

Böylece CSP/security davranışı ve JSON response biçimi `server.mjs` ile tek kaynakta kalır; provider route yeni paralel bir genel HTTP framework'ü oluşturmaz.

## Cancellation

Her eşleşen request için server-side `AbortController` oluşturulur. Response `close` olayı provider runtime'a verilen signal'ı abort eder. Provider sonucu bağlantı kapandıktan sonra gelirse response yazılmaz.

Streaming sırasında bağlantı kapanırsa pump durur. Provider stream exception üretirse exception metni, path veya token response'a taşınmaz; bağlantı hâlâ açıksa yalnız sabit `STREAM_INTERRUPTED` SSE hatası yazılır.

## Header güvenliği

Runtime'dan gelen response header'ları ikinci kez fail-closed doğrulanır. Şunlar reddedilir:

- `Authorization`,
- `Cookie`,
- `Set-Cookie`,
- `Proxy-Authorization`,
- CR/LF içeren header adı veya değeri,
- boş/aşırı uzun header değerleri.

Bu kontrol #137'deki HTTP API doğrulamasını değiştirmez; Node sınırında defense-in-depth sağlar.

## Provider ve tool ayrımı

Bu bridge provider seçimi yapmaz. NVIDIA NIM varsayılan provider olarak production runtime sözleşmesinde kalır; local/Ollama yalnız explicit opt-in ile kullanılabilir.

`/api/chat` bu basit route'ta tool calling açmaz. `tools` ve `tool_choice` #137 HTTP boundary'sinde reddedilmeye devam eder. `/api/agent/run` tool calling ve backend default-deny authorization için ayrı yol olmaya devam eder.

## Production wiring hedefi

Bu katmandan sonra `server.mjs` için kalan entegrasyon küçüktür:

1. model-provider HTTP server runtime'ını mevcut agent/context preparation callback'iyle compose et,
2. bu Node route'u mevcut `sendJson` ve `setSecurityHeaders` fonksiyonlarıyla oluştur,
3. `/api/models` ve `/api/chat` isteklerini route'a geçir,
4. health response'una yalnız boolean local-provider capability ekle,
5. `/api/agent/run`, scheduler, context summarizer ve screen analysis NVIDIA-only davranışını değiştirme.

Gerçek server wiring ayrı diff olarak kalır; büyük `server.mjs` dosyasını checkout olmadan riskli tam-dosya replacement ile değiştirmek bu PR'ın amacı değildir.
