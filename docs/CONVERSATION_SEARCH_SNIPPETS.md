# Conversation search snippet contract

Hafize sohbet araması içerikten eşleşen bir sohbeti gizli bir neden olmadan göstermemelidir. Bu katman, mevcut canonical local conversation search sonucuna yalnız kısa bir bağlam satırı ekler.

## Veri kaynağı

- Kaynak yalnız `HafizeConversationStorageGuard.sanitizeStoredValue()` çıktısıdır.
- Yalnız `user` ve `assistant` mesajları değerlendirilir.
- `system`, `developer`, `tool`, owner/trace metadata'sı, token ve credential alanları snippet üretimine girmez.
- Guard yoksa veya storage okunamazsa ham localStorage parse edilmez; snippet gösterilmez.

## Bounded davranış

- Arama sorgusu en fazla 120 karakterdir.
- En fazla 30 canonical sohbet incelenir.
- Sohbet başına en fazla 200 mesaj taranır.
- İlk mesaj eşleşmesi kullanılır.
- Gösterilen bağlam yaklaşık 180 karakterle sınırlıdır ve `Sen:` / `Hafize:` rol etiketi taşır.

## Gizlilik ve güvenlik

- Snippet yalnız sayfa belleği/DOM içinde yaşar; yeni persistent storage alanı yoktur.
- Arama sorgusu veya snippet backend'e, memory API'ye veya connector'a gönderilmez.
- UI yalnız `textContent` kullanır; HTML parse/injection yolu yoktur.
- Yeni fetch/XHR/WebSocket, clipboard, cookie veya credential erişimi yoktur.
- Agent roster, backend default-deny tool policy ve external write/send/merge approval sınırları değişmez.

## Lifecycle

Arama input'u, conversation-list render'ı, canonical conversation storage merge'i ve cross-tab storage değişimi snippet görünümünü yeniden hesaplar. Query temizlenirse veya satır artık görünür değilse snippet gizlenir.

## Geri alma

`conversation-search-snippets.js`, startup/PWA wiring'i, regresyon testleri ve bu sözleşme kaldırılır. Mevcut canonical conversation search davranışı ayrı olarak çalışmaya devam eder.
