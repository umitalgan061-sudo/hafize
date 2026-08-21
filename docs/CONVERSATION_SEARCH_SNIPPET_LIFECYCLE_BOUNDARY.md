# Conversation search snippet lifecycle boundary

`conversation-search-snippets.js`, sohbet geçmişi aramasında eşleşen `user` / `assistant` mesajlarından kısa bir bağlam satırı üretir. Bu yüzey yalnız okuma ve görünüm katmanıdır; canonical conversation storage üzerinde yazma yetkisi yoktur.

## Ownership

- Her `#conversationList` aynı anda en fazla bir snippet controller tarafından sahiplenilir.
- Duplicate controller kurulumu fail-closed olur; DOM marker silinmesi sahipliği devretmez.
- Controller yalnız kendi oluşturduğu snippet node'larını ve style node'unu teardown sırasında kaldırabilir.
- Host tarafından önceden sağlanmış `.conversation-search-snippet` node'u varsa `textContent` ve `hidden` durumu ilk dokunuştan önce snapshot edilir ve teardown/rollback sırasında exact restore edilir.
- Host tarafından önceden sağlanmış style node'u silinmez veya değiştirilmez.

## Installation transaction

Input/storage listener'ları, MutationObserver ve ilk render tek installation sınırı olarak değerlendirilir. Listener veya observer kurulumu hata verirse:

1. eklenmiş listener'lar kaldırılır,
2. observer kapatılır,
3. controller-owned snippet/style kaynakları geri alınır,
4. host snippet state'i restore edilir,
5. list ownership serbest bırakılır.

Böylece başarısız kurulumdan sonra temiz yeni controller mount edilebilir.

## Deferred refresh lifecycle

Arama input'u, canonical storage event'i veya list visibility değişikliği refresh isteyebilir. Refresh çağrıları tek pending RAF/timer altında coalesce edilir.

- RAF varsa `requestAnimationFrame` kullanılır ve teardown'da `cancelAnimationFrame` ile iptal edilir.
- RAF yoksa timer fallback kullanılabilir ve teardown'da `clearTimeout` ile iptal edilir.
- Hiç scheduler yoksa refresh fail-closed biçimde başlatılmaz.
- Destroy veya ownership kaybından sonra stale callback canonical storage okuyamaz ve DOM'u değiştiremez.

## Veri sınırı

Snippet corpus'u mevcut bounded sözleşmeyi korur:

- en fazla 30 conversation,
- conversation başına en fazla 200 message,
- yalnız `user` ve `assistant` rolleri,
- query en fazla 120 karakter,
- snippet yaklaşık 180 karakterlik bounded pencere.

`tool` ve `system` içerikleri snippet'e taşınmaz. Storage yalnız `HafizeConversationStorageGuard` üzerinden sanitize edilmiş değer olarak okunur; guard yoksa boş corpus kullanılır.

## Değişmeyen güvenlik sınırları

Bu controller:

- conversation storage yazmaz,
- dış servise istek göndermez,
- secret veya credential okumaz,
- agent/tool yetkisi vermez,
- görünürlük filtresinin sahipliğini üstlenmez.

Arama satırının `hidden` durumu conversation-search controller tarafından yönetilir; snippet katmanı yalnız görünür satırlarda bağlam metni gösterir.
