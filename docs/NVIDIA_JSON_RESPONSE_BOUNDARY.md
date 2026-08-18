# NVIDIA JSON response boundary

## Amaç

Hafize'nin non-stream NVIDIA completion yolu provider cevabını artık sınırsız `response.text()` ile belleğe almamalıdır. Hatalı veya beklenmeyen upstream cevapları process belleğini gereksiz büyütememeli ve başarılı cevaplar beklenen JSON medya tipi dışında kabul edilmemelidir.

## Sınırlar

- Varsayılan maksimum JSON response gövdesi: **4 MiB**.
- Helper'ın izin verdiği mutlak üst sınır: **16 MiB**.
- Provider hata ayrıntısı preview'i varsayılan **1200 byte**, mutlak en fazla **4096 byte**.
- `Content-Length` limiti önceden aşıyorsa body best-effort cancel edilir ve okunmaz.
- Chunked cevapta gerçek byte toplamı ölçülür; sınır aşılırsa body best-effort cancel edilir.
- Başarılı cevap yalnız `application/json` veya `application/*+json` medya tipinde kabul edilir.
- Geçersiz JSON veya yanlış başarılı medya tipi `INVALID_NVIDIA_RESPONSE` olur.
- Limit aşımı `NVIDIA_RESPONSE_TOO_LARGE` olarak sabitlenir.
- Non-2xx cevap mevcut `NVIDIA_CHAT_ERROR` sözleşmesini ve HTTP status bilgisini korur; yalnız bounded preview taşır.

## Kapsam

Bu sınır `server.mjs` içindeki ortak `nvidiaJsonCompletion` yoluna bağlıdır. Böylece normal agent completion, delegated agent completion, context compaction, screen analysis'ın bu completion callback'ini kullanan yolları ve scheduled NVIDIA completion aynı bounded reader'dan yararlanır. Streaming SSE yolu ayrı bounded streaming sözleşmelerini kullanmaya devam eder.

## Güvenlik

Bu değişiklik model seçimi veya tool permission vermez. NVIDIA NIM ana provider kalır; local provider adaptörü kendi ayrı response sınırlarını korur. Dört profilli agent roster, backend default-deny, external write/send/merge approval ve secret izolasyonu değişmez. Raw provider error body agent context'e veya kalıcı storage'a yazılmaz.

## Geri alma

`lib/nvidia-json-response.mjs`, server import/wiring, testler ve bu belge birlikte revert edilebilir. Endpoint, schema, PWA cache veya kalıcı veri migrasyonu yoktur.
