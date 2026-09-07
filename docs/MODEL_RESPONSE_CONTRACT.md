# Model response contract

NVIDIA/OpenAI-benzeri provider cevapları execution katmanına girmeden önce normalize edilebilir: content, finishReason, toolCalls, usage, model ve responseId.

`finishReason=tool_calls` terminal kabul edilmez; `stop`, `length`, `content_filter` terminal davranışa işaret eder. Bilinmeyen provider reason değerleri `unknown` olur. Content, tool-call sayısı ve argument boyutları bounded tutulur.

Bu contract provider entegrasyonunu değiştirmez; downstream tool runtime ve UI katmanlarının güvenilir, provider-independent bir veri şekli tüketmesini sağlar.
