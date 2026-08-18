# Conversation branch lineage

Hafize fork ve mesaj-düzenleme/retry dallarının kaynak sohbetle ilişkisini transcript'ten ayrı, küçük bir metadata sözleşmesinde tutar.

## Saklanan alanlar

`hafize.conversation-branches.v1` yalnız şu alanları kabul eder:

- `childConversationId`
- `parentConversationId`
- `sourceMessageId`
- `mode`: yalnız `fork` veya `edit`
- `createdAt`

En fazla **60** ilişki tutulur. ID'ler en fazla 120 karakter ve dar ASCII allowlist'iyle doğrulanır. Child ve parent aynı olamaz. Parent veya child canonical conversation storage'da artık yoksa ilişki okunurken fail-closed dışlanır.

Mesaj gövdesi, sohbet başlığı, model içeriği, tool sonucu, `ownerId`, `traceId`, credential, token veya connector verisi lineage store'a yazılmaz.

## Üreticiler

- `conversation-fork.js`, canonical fork başarıyla persist edildikten sonra yalnız ID metadata'sı içeren `hafize:conversation-branched` event'i yayınlar.
- `message-edit.js`, canonical edit/retry branch başarıyla persist edildikten sonra aynı event'i `mode=edit` ile yayınlar.
- Lineage metadata yazımı transcript oluşturma işleminin şartı değildir; metadata katmanı başarısız olursa mevcut güvenli branch oluşturma yolu geri alınmaz.

## UI

Aktif sohbet bir child branch ise chat alanında küçük bir lineage banner'ı görünür. `Kaynak sohbeti aç` eylemi yalnız mevcut local conversation listesinde exact parent ID'ye eşleşen satırı açar; yeni network veya provider isteği üretmez.

## Güvenlik sınırı

- Yeni backend endpoint veya network isteği yoktur.
- Yeni agent/tool permission yoktur.
- HTML injection kullanılmaz; UI sabit metinleri `textContent` ile üretir.
- Metadata localStorage'da transcript'ten ayrı tutulur ve bounded'dır.
- Storage event yalnız aynı origin'deki sekmeler arasında görünümü yeniler.
- PWA shell v99 lineage runtime'ını offline shell'e dahil eder; `/api/*` network-only kalır.
