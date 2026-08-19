# Conversation branch ancestry contract

Hafize branch lineage çok seviyeli sohbet dallarında güvenli kaynak ve kök gezinmesi sağlar.

## Veri modeli

Mevcut `hafize.conversation-branches.v1` şeması değişmez. Her kayıt yalnız `childConversationId`, `parentConversationId`, `sourceMessageId`, `mode` ve `createdAt` alanlarını taşır. Mesaj metni veya sohbet içeriği lineage metadata'ya eklenmez.

## Graph sınırları

- En fazla 60 lineage kaydı değerlendirilir.
- `child === parent` reddedilir.
- Accepted parent zincirinden tekrar child'a dönen yeni ilişki cycle olarak reddedilir.
- Aynı child için ilk canonical kayıt korunur.
- UI ancestry çözümü tek seferde en fazla 12 parent seviyesini izler.
- Elle değiştirilmiş daha derin bir zincirde traversal 12 seviyede durur; Hafize görünmeyen daha uzak ancestor için kesin root iddiası üretmez.

Bu sınırlar bozuk metadata'nın sonsuz gezinme döngüsü oluşturmasını engeller.

## UI davranışı

`Kaynak sohbeti aç` direct parent conversation'a gider. Güvenilir ancestry birden fazla seviye içeriyorsa banner dal derinliğini gösterir ve `Kök sohbeti aç` eylemini sunar. Tek seviyeli branch'te root düğmesi gizlidir.

Conversation row identity çözümü `CONVERSATION_ROW_IDENTITY_CONTRACT.md` sözleşmesini kullanır; pinned veya yeniden sıralanmış satırlarda hedef index üzerinden tahmin edilmez. Hedef satır bulunamazsa click üretilmez.

## Güvenlik

Bu özellik yalnız local canonical conversation ve branch metadata'sını kullanır. Yeni backend endpoint, provider isteği, connector veya agent tool yetkisi eklemez. Dört profilli roster ve backend default-deny politikası değişmez. Visible metinler HTML olarak parse edilmez.

## Testler

- `scripts/test-conversation-branch-ancestry.mjs`: multi-level chain, root çözümü, cycle rejection, duplicate child ve bounded traversal.
- `scripts/test-conversation-branch-ancestry-controller.mjs`: source/root navigation, banner derinliği, tek-level root-button ve cyclic record reddi.
- `scripts/test-conversation-branch-ancestry-security.mjs`: network/HTML/shell yüzeyi ve dört ajanlı default-deny sözleşmesi.
