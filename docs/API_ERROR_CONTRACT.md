# API error contract

HTTP API hataları artık provider-specific metinlere bağlı olmayan stabil error envelope ile normalize edilebilir: `error`, `status`, `message` ve isteğe bağlı `requestId`.

Bilinmeyen hata kodları `INTERNAL_ERROR` olur. Authorization/credential gibi detaylar sınırsız ham upstream mesajıyla taşınmaz; mesaj boyutu ve kontrol karakterleri sınırlandırılır. Retry kararı 408/425/429 veya 5xx sınıfından deterministic olarak türetilir.

Tool failure sonuçları da aynı envelope'a map edilebilir. Bu contract karar vermeyi kolaylaştırır; auth veya retry işlemini kendi başına gerçekleştirmez.
