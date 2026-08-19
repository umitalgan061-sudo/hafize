# Conversation lineage source-retention contract

## Amaç

Hafize konuşma dalları `childConversationId`, `parentConversationId` ve `sourceMessageId` ile kaynak tura bağlanır. Konuşma geçmişi bounded olduğu için parent sohbet yaşamaya devam ederken eski source mesaj retention tarafından düşürülebilir. Bu belge, böyle bir durumda lineage metadata'nın nasıl fail-closed temizleneceğini tanımlar.

## Authoritative veri

- Konuşma ve mesaj varlığı için authoritative kaynak canonical `hafize.conversations.v1` snapshot'ıdır.
- Snapshot önce `HafizeConversationStorageGuard.sanitizeStoredValue()` sınırından geçer.
- Lineage storage mesaj içeriği, başlık, model sonucu, tool sonucu, owner, trace veya credential için authoritative değildir.
- Parent ve child conversation ID'leri canonical snapshot'ta bulunmalıdır.
- `sourceMessageId` canonical **parent** conversation içindeki retained message ID setinde bulunmalıdır.
- Edit/retry dallarında source mesajın child içinde bulunması gerekmez; edited source child history'ye bilinçli olarak kopyalanmayabilir.

## Bounded index

Lineage controller canonical sohbetlerden yalnız ID tabanlı bir index üretir:

`Map<conversationId, Set<messageId>>`

Mevcut conversation storage sözleşmesi en fazla 30 sohbet ve sohbet başına 200 mesaj tuttuğu için normal üst sınır 6.000 retained message ID'dir. Index mesaj metni veya başka payload saklamaz.

## Fail-closed davranış

Aşağıdaki kayıtlar okunurken ve yazılırken reddedilir:

- parent veya child canonical snapshot'ta yoksa,
- source ID parent'ın retained message setinde yoksa,
- conversation/message ID prototype üzerinden miras alınmışsa,
- source ID malformed ise,
- mevcut ancestry cycle/depth veya duplicate-child kurallarını ihlal ediyorsa.

Parent/child var olduğu halde source retention nedeniyle düşmüşse kayıt stale kabul edilir. Bu kayıt sibling/alternative gruplamasına, source/root navigasyonuna veya current-context görünümüne giremez.

## Compaction

`compactStoredEntries()` stale source kayıtlarını best-effort olarak lineage storage'dan çıkarır. Storage write başarısız olsa bile `readEntries()` aynı canonical index ile normalize edildiği için stale ilişki o sayfa oturumunda kullanılmaz. Persistence başarısızlığı güvenlik/correctness filtresini geri açmaz.

## Yeni branch kaydı

`record()` branch event'ini yazmadan önce source ID'nin canonical parent mesajlarında bulunduğunu yeniden doğrular. Böylece retention veya cross-tab değişikliği ile kaybolmuş source anchor üzerine yeni lineage kaydı üretilemez.

## Geriye uyumluluk

Pure helper testlerinde kullanılan eski `Set<conversationId>` doğrulaması yalnız conversation-membership sözleşmesini korur. Production controller daima message-aware `Map` kullanır; source-retention enforcement production read/write/record yollarında zorunludur.

## Veri minimizasyonu

Source index ve lineage kaydı yalnız bounded ID metadata'sı taşır. Mesaj `content` alanı, secret canary, token, cookie, ownerId, traceId veya connector/provider payload'ı index'e ya da lineage JSON'una kopyalanmaz.

## Test beklentileri

Regresyonlar en az şunları doğrular:

1. Var olan parent/source kaydı korunur.
2. Parent/child var olsa bile missing source kaydı atılır.
3. Aynı expired source'u paylaşan alternatiflerin tamamı atılır.
4. Prototype/inherited message ID source olarak kabul edilmez.
5. 30 × 200 canonical message ID index'i bounded çalışır.
6. Persistence write başarısız olsa bile stale source read path'te görünmez.
7. `record()` missing parent source için false döner.
8. Mesaj içeriği ve secret canary lineage metadata'ya kopyalanmaz.

## Değişmeyen güvenlik sınırları

Bu değişiklik yeni endpoint, provider request, persistent memory write, connector yetkisi veya agent tool permission eklemez. Dört profilli selector/specialist roster, backend default-deny policy, external write/send/merge explicit approval ve secret izolasyonu değişmez.
