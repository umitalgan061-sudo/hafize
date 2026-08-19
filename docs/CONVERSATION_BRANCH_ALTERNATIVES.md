# Conversation branch alternative navigation

Hafize konuşma dalları artık yalnız kaynak ve kök sohbete dönmeyi değil, aynı noktadan üretilmiş alternatif dallar arasında güvenli gezinmeyi de destekler.

## Ürün davranışı

Bir branch kaydı şu kimliklerle tanımlanır:

- `childConversationId`
- `parentConversationId`
- `sourceMessageId`
- `mode`
- `createdAt`

İki branch yalnız hem `parentConversationId` hem de `sourceMessageId` aynıysa alternatif kardeş sayılır. Sadece aynı parent'a bağlı olmak yeterli değildir; farklı mesajlardan oluşturulmuş dallar birbirinin alternatifi olarak sunulmaz.

Kardeşler `createdAt` değerine göre eskiden yeniye sıralanır. Eşit timestamp durumunda `childConversationId` deterministik bağlayıcıdır. Aktif dal için arayüz:

- uygun olduğunda `← Önceki alternatif`,
- uygun olduğunda `Sonraki alternatif →`,
- mevcut `Kaynak sohbeti aç`,
- çok seviyeli lineage varsa `Kök sohbeti aç`

eylemlerini gösterir.

Etiket yalnız birden fazla alternatif varsa `alternatif N/M` bilgisini gösterir. Tek kardeşli lineage mevcut görünümü gereksiz bilgiyle kalabalıklaştırmaz.

## Güvenlik sınırı

Bu özellik yalnız mevcut, canonical conversation ve lineage metadata'sını okur. Yeni backend endpoint veya ağ isteği açmaz.

Aşağıdaki veriler sibling navigation sözleşmesinin parçası değildir:

- mesaj gövdeleri,
- sohbet başlıkları,
- owner kimliği,
- trace kimliği,
- model veya tool sonucu,
- access/refresh token,
- OAuth veya connector credential.

Navigasyon hedefi yalnız mevcut `conversation-row` içindeki doğrulanmış conversation ID üzerinden bulunur ve mevcut `.conversation-open` kullanıcı eylemini tetikler. Serbest URL, HTML veya dış hedef üretilmez.

## Bounded davranış

- Lineage store üst sınırı: 60 kayıt.
- Ancestry traversal üst sınırı: 12 seviye.
- Conversation ID üst sınırı: 120 karakter ve dar ASCII allowlist.
- Kardeş listesi de normalize edilmiş aynı 60 kayıtlık set içinden hesaplanır.

Bu nedenle alternatif gezinme ek bir sınırsız graph traversal veya storage taraması oluşturmaz.

## Fail-closed kuralları

Şu durumlarda alternatif navigasyon gösterilmez:

- aktif conversation ID doğrulanamıyorsa,
- aktif sohbetin canonical lineage kaydı yoksa,
- parent veya source-message kimliği malformed ise,
- lineage kaydı cycle/depth normalizasyonundan geçemiyorsa,
- hedef sohbet conversation listesinde mevcut değilse,
- hedef row `.conversation-open` eylemini sunmuyorsa.

Malformed veya stale metadata yeni yetki, network veya HTML yüzeyi açmaz.

## Erişilebilirlik

Masaüstünde mevcut kompakt lineage banner korunur. Mobilde branch eylemleri minimum 44 px dokunma hedefi kullanır. `focus-visible` ve forced-colors sınırları previous/next düğmelerine de uygulanır.

## Agent ve tool politikası

Bu özellik ajan registry'sini değiştirmez. Aktif roster iki selector ve iki specialist olmak üzere dört profildir. Provider seçimi, konuşma dalı veya UI navigasyonu tool izni üretmez. Backend default-deny, external write/send/merge explicit approval ve secret izolasyonu değişmez.

## Geri alma

Bu geliştirme geri alınacaksa sibling resolver, previous/next düğmeleri, alternatif etiketi, ilgili testler ve bu belge kaldırılır. Parent/root lineage navigasyonu ve önceki row-identity/cycle korumaları ayrı davranış olarak kalabilir.
