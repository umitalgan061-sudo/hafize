# Model response contract

NVIDIA/OpenAI-benzeri provider cevapları execution katmanına girmeden önce normalize edilir: content, finishReason, toolCalls, usage, model ve responseId.

`content` ve `finishReason` alanları beklenen tipte değilse contract artık sessizce boş/`unknown` üretmek yerine cevabı reddeder. `finishReason=tool_calls` terminal kabul edilmez; `stop`, `length`, `content_filter` terminal davranışa işaret eder. Bilinmeyen provider reason değerleri `unknown` olur. Content, tool-call sayısı ve argument boyutları bounded tutulur.

Bu contract provider entegrasyonunu değiştirmez; downstream tool runtime ve UI katmanlarının güvenilir, provider-independent bir veri şekli tüketmesini sağlar. Contract kullanan yollar malformed provider cevabını güvenilir biçimde execution dışına çıkarır.

Normalizasyon idempotenttir: tool call'lar hem provider şeklinde (`{ function: { name, arguments } }`) hem de normalize edilmiş şekilde (`{ name, arguments }`) kabul edilir, böylece normalize edilmiş bir cevabı `isTerminalModelResponse()` gibi yardımcılara vermek hata üretmez. Eksik çağrı kimliği `INVALID_MODEL_TOOL_CALL_ID`, eksik ad `INVALID_MODEL_TOOL_CALL_NAME` olarak raporlanır.
