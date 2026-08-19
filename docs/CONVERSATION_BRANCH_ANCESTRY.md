# Conversation branch ancestry contract

Hafize conversation branching artık yalnız doğrudan parent ilişkisini göstermekle kalmaz; bounded ve acyclic bir ancestry zinciri kurarak çok seviyeli dallarda kullanıcıya güvenli kaynak/kök gezinmesi sağlar.

## Veri modeli

Mevcut `hafize.conversation-branches.v1` şeması değişmez. Her kayıt yalnız:

- `childConversationId`
- `parentConversationId`
- `sourceMessageId`
- `mode: fork|edit`
- `createdAt`

alanlarını taşır. Mesaj metni, başlık, model/tool sonucu, owner/trace, token veya credential lineage metadata'ya eklenmez.

## Acyclic ve bounded graph

- Maksimum lineage kaydı 60'tır.
- Tek ancestry yolu maksimum 12 seviyedir.
- `child === parent` reddedilir.
- Yeni kayıt mevcut accepted parent zincirinden tekrar child'a dönüyorsa cycle kabul edilmez.
- Yeni kayıt 12 seviyelik sınırı aşan ancestry oluşturuyorsa fail-closed dışlanır.
- Aynı child için ilk canonical kayıt korunur; duplicate child yeni bir parent ilişkisiyle graph'ı değiştiremez.

Bu sınır bozuk veya elle değiştirilmiş localStorage'ın sonsuz source-navigation döngüsü ya da sınırsız ancestry traversal üretmesini engeller.

## UI davranışı

Doğrudan child branch için mevcut `Kaynak sohbeti aç` düğmesi korunur. Branch birden fazla parent zincirine sahipse banner ayrıca dal seviyesini gösterir ve `Kök sohbeti aç` düğmesini görünür yapar.

- `Kaynak sohbeti aç`: yalnız direct parent conversation'a gider.
- `Kök sohbeti aç`: bounded ancestry zincirinin en üst canonical conversation'ına gider.
- Tek seviyeli branch'te kök düğmesi gösterilmez; source zaten root'tur.
- Conversation row identity çözümü `CONVERSATION_ROW_IDENTITY_CONTRACT.md` sözleşmesini kullanır; pinned/reordered satırlarda yanlış hedef seçilmez.
- Hedef conversation satırı bulunamazsa click üretilmez ve işlem fail-closed kalır.

## Güvenlik

Bu özellik yalnız local, canonical conversation ve branch metadata'sını okur. Yeni backend endpoint, fetch/XHR/WebSocket, connector, provider isteği, persistent secret alanı veya agent tool permission eklemez. Dört profilli roster ve backend default-deny politikası aynen korunur.

Visible içerik yalnız sabit ürün metnidir ve `textContent` üzerinden yazılır; branch metadata HTML olarak render edilmez.

## Testler

- `scripts/test-conversation-branch-ancestry.mjs`: multi-level chain, root çözümü, cycle rejection, duplicate child ve depth bound.
- `scripts/test-conversation-branch-ancestry-controller.mjs`: gerçek controller üzerinde source/root gezinmesi, banner derinliği, tek-level root-button gizleme ve cyclic `record()` reddi.
- `scripts/test-conversation-branch-ancestry-security.mjs`: network/secret/HTML/shell yüzeylerinin açılmaması ile dört ajanlı default-deny sözleşmesi.
