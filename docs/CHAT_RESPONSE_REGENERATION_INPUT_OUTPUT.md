# Input / Output Sözleşmesi

## Input
Regeneration messageId alır.

Conversation içindeki messageId assistant rolündeki son mesaja karşılık gelmelidir.

Model ve agent active UI state'ten alınır.

## Output
Başarılı SSE stream assistant content üretir.

Eski content alternates içine taşınır.

Generation metadata güncellenir.

## Failure output
HTTP veya stream failure durumunda eski content korunur.

UI kullanıcıya kısa hata mesajı gösterir.

## Feedback
Feedback action response generation gerektirmez.

## Copy
Copy action yalnız mevcut content'i Clipboard API'ye verir.

## No submit
Hiçbir action form requestSubmit çağırmaz.
