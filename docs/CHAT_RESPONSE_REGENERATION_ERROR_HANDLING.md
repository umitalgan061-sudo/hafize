# Yanıt Regeneration Hata İşleme

## Ön koşul hataları
Model, ajan veya ağ uygun değilse yeni HTTP isteği başlatılmaz.

## HTTP hataları
API hata döndürürse stream parser exception verir. Catch bloğu mevcut yanıtı geri koyar.

## SSE hataları
Parçalı stream yarım kalsa bile eski response değişkeni memory'de tutulur.

## Empty response
Endpoint boş cevap döndürürse mevcut consumeAssistantStream sözleşmesindeki kullanıcı mesajı kullanılabilir; regeneration başarısız kabul edildiğinde önceki content geri alınır.

## Tool failure
Araç modunda endpoint /api/agent/run olur. Tool activity temizlenir ve eski cevap korunur.

## Clipboard
Clipboard API yoksa veya izin reddedilirse yalnız kopyalama eylemi başarısız olur; sohbet içeriği etkilenmez.

## Storage
saveConversations mevcut uygulamanın bounded local persistence katmanıdır. Yeni ayrı storage sistemi yoktur.

## UI recovery
Hata sonrası isStreaming false olur, composer tekrar etkinleşir ve focus mesaj alanına döner.

## Güvenli hata
Kullanıcıya endpoint body, token veya stack trace gösterilmez. Kısa kullanıcı odaklı toast kullanılır.
