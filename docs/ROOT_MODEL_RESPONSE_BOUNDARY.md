# Root model response boundary

`/api/agent/run` yolu NVIDIA chat completion cevabını tool execution veya HTTP success yüzeyine taşımadan önce `normalizeNvidiaChatCompletion()` üzerinden geçirir.

## Garantiler

- Assistant mesajının provider envelope'u canonical Hafize model şekline normalize edilir.
- Content ve finish reason tipleri strict olarak doğrulanır.
- Tool-call kimliği, adı ve argument sınırları ortak model contract'ı tarafından uygulanır.
- Malformed provider cevapları `INVALID_NVIDIA_RESPONSE` olarak root execution'dan çıkarılır.
- Context compaction summary cevabı da aynı provider response contract'ından geçirilir.

Bu katman provider değişimini veya yeni yetkiyi üretmez; yalnız model çıktısının güvenilir shape'e inmesini zorunlu kılar.
