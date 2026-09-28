# Hata Ayıklama Oyun Planı

## Buton görünmüyor
Message role ve son message eligibility kontrol edilir.

## Buton pasif
isStreaming, networkOnline, model ve agent state kontrol edilir.

## Yeni cevap gelmiyor
SSE response status ve body kontrol edilir.

## Eski cevap kayboldu
Catch rollback yolu ve local save çağrısı kontrol edilir.

## Restore yanlış varyant
alternates sırasının newest-first olması kontrol edilir.

## Feedback kayboldu
normalizeMessage feedback enum ve saveConversations kontrol edilir.

## Copy başarısız
Clipboard API/permission ayrı incelenir.

## PWA farkı
typed-build çıktısı ve cache metadata kontrol edilir.

## Test
Önce response-variants unit testleri, sonra source-contract, sonra build/typecheck çalıştırılır.
