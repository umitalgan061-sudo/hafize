# Model Provider HTTP Boundary

Bu katman NVIDIA NIM ana sağlayıcısını ve opt-in loopback local/Ollama sağlayıcısını doğrudan `server.mjs` içine dağıtmadan `/api/models` ve basit streaming `/api/chat` akışına bağlamak için dar bir HTTP sözleşmesi tanımlar.

## Güvenlik sınırı

- HTTP katmanı provider secret veya environment okumaz; bunlar production provider runtime içinde server-side kalır.
- `/api/chat` istemci gövdesini doğrudan modele göndermez. `prepareChat` callback'i mevcut agent/message/context doğrulamasını ve system mesajı üretimini server tarafında yapmak zorundadır.
- Hazırlanan payload `stream: true` olmalıdır ve `tools` / `tool_choice` içeremez. Tool calling `/api/agent/run` içindeki backend default-deny permission enforcement yolunda kalır.
- Hazırlama katmanından response header taşınabilir, fakat Authorization, Cookie, Set-Cookie ve Proxy-Authorization header'ları reddedilir; CR/LF enjeksiyonu da fail-closed olur.
- Provider hata ayrıntıları HTTP body'ye yansıtılmaz. Yalnız sanitize `{error}` kodu döner.
- AbortSignal model discovery ve streaming provider çağrısına aynen aktarılır.

## Production wiring sınırı

Bu PR `server.mjs` dosyasını değiştirmez. Sonraki wiring adımı mevcut `handleModels` ve basit `handleChat` çağrılarını bu API'ye delege etmeli; `prepareChat` içinde mevcut `normalizeClientMessages`, agent seçimi, trace id, context compaction ve sıcaklık/top-p sınırlarını korumalıdır.

`/api/agent/run`, scheduler, screen analysis ve context compaction NVIDIA-only davranışını bu katman değiştirmez. Local model tool calling ancak provider-independent backend authorization ve agent-run akışı ayrıca tasarlanıp test edilirse açılabilir.
