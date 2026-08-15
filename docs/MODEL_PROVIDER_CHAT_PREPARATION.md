# Model provider chat preparation contract

Bu katman, `POST /api/chat` istemci gövdesi ile NVIDIA/local provider runtime arasında backend'e ait güven sınırıdır.

## Sorumluluk

`createModelProviderChatPreparer()` yalnız şu client alanlarını kabul eder:

- `model`
- `messages`
- `agentId`
- `max_tokens`
- `temperature`
- `top_p`

Unknown alanlar reddedilir. Özellikle client `tools`, `tool_choice`, credential, provider secret veya benzeri ek alanlarla yetki kazanamaz.

Agent seçimi `agents/registry.json` üzerinden yapılır. Client `system` veya `tool` rolü gönderemez; system mesajı backend tarafından `buildAgentSystemMessage()` ile oluşturulur. Böylece model sağlayıcısı değişse bile agent/tool permission sözleşmesi backend default-deny kalır.

## Context ve trace

Hazırlık her request için server-side `trace_id` üretir ve system mesajına yerleştirir. Context compactor provider çağrısından önce çalışır. Public response için yalnız şu metadata header'ları hazırlanır:

- `X-Hafize-Trace-Id`
- `X-Hafize-Context-Compacted`
- `X-Hafize-Context-Tokens-Before`
- `X-Hafize-Context-Tokens-After`

Credential veya agent tool policy header/body'ye taşınmaz.

## Provider ayrımı

`local:` model seçimi yalnız inference provider routing bilgisidir. Bu seçim tool yetkisi, external write izni veya agent permission artışı değildir. Basit `/api/chat` provider yolu tool calling açmaz; tool kullanan akış `/api/agent/run` backend authorization katmanında kalır.

## HTTP hata sınırı

`model-provider-http-api` body okuma ve chat preparation hatalarını public sabit error code'lara indirger:

- invalid request / agent → `400`
- invalid JSON → `400`
- body limit → `413`
- cancellation → `499`
- bilinmeyen hazırlık hatası → `CHAT_PREPARATION_FAILED`

Raw exception, filesystem path, token veya provider detail public response'a yansıtılmaz.

## Production wiring sınırı

Bu PR `server.mjs` route wiring'ini değiştirmez. Sonraki production adımı mevcut `model-provider-http-server-runtime` ve `model-provider-node-http-route` ile bu preparer'ı compose ederek yalnız `/api/models` ve basit `/api/chat` yollarını yeni provider zincirine taşımalıdır. `/api/agent/run`, scheduler, context summarizer ve screen analysis NVIDIA-only kalabilir.
