# Conversation lineage retention contract

Hafize conversation lineage metadata'sı yalnız yaşayan canonical konuşmalar için tutulur. Bir sohbet silindiğinde veya tüm geçmiş temizlendiğinde o konuşmaya ait stale branch ilişkilerinin localStorage'da süresiz kalması gerekmez.

## Amaç

Lineage store yalnız navigasyon için gerekli minimum metadata'yı taşır:

- child conversation ID,
- parent conversation ID,
- source message ID,
- branch modu,
- creation timestamp.

Conversation kaydı artık canonical `hafize.conversations.v1` içinde yoksa child veya parent olarak ona bağlı lineage girdisi geçersiz sayılır.

## Compaction davranışı

Lineage controller render sırasında canonical conversation listesini alır ve mevcut lineage değerini aynı valid conversation ID setiyle normalize eder.

Raw değer ile canonical JSON aynıysa storage yeniden yazılmaz. Farklıysa yalnız normalize edilmiş bounded metadata geri yazılır. Böylece:

- silinmiş child branch kayıtları kaldırılır,
- silinmiş parent'a bağlı kayıtlar kaldırılır,
- malformed kayıtlar kaldırılır,
- duplicate child ilişkileri kaldırılır,
- cycle/depth kurallarını geçemeyen ilişkiler kaldırılır,
- conversation listesi tamamen boşsa lineage `[]` haline gelir.

Compaction başarısız olursa okuma yolu yine stale metadata'yı canonical conversation setine göre filtreler. Yani quota/storage yazma hatası navigation güvenlik sınırını gevşetmez.

## Aynı sekme ve diğer sekmeler

Conversation listesi aynı sekmede yeniden render edildiğinde MutationObserver render yolunu tetikler ve compaction yapılır. Başka sekmede conversation veya lineage storage değiştiğinde `storage` olayı render/compaction yolunu yeniden çalıştırır.

Bu özellik yeni bir cross-tab mesaj kanalı veya network synchronization katmanı eklemez.

## Boyut sınırı

Lineage raw storage değeri en fazla **64 KiB karakter** olarak parse edilir. Daha büyük değer fail-closed boş lineage olarak değerlendirilir ve controller compaction fırsatında `[]` ile küçültür.

Normal canonical store ayrıca mevcut **60 kayıt** üst sınırını korur. Conversation ID uzunluğu **120 karakter**, ancestry traversal ise **12 seviye** ile bounded kalır.

## Veri minimizasyonu

Compaction yeni veri üretmez. Mesaj metni, sohbet başlığı, model/tool sonucu, owner/trace, token, cookie veya OAuth credential lineage store'a eklenmez.

## Güvenlik ve tool politikası

Bu değişiklik yalnız local conversation metadata retention'ıdır. Yeni backend endpoint, network isteği, provider çağrısı, connector veya agent tool yetkisi yoktur.

Aktif roster dört profildir. Backend default-deny, external write/send/merge explicit approval, shared trace ve secret izolasyonu aynen korunur.

## Hata davranışı

- localStorage read hatası: compaction yapılmaz, güvenli boş/read-filter davranışı korunur.
- localStorage write hatası: hata dışarı taşınmaz; navigation read-filter ile stale kayıtları kullanmaz.
- malformed JSON: canonical lineage boş kabul edilir.
- oversized raw değer: parse edilmez.
- canonical değer: gereksiz rewrite yapılmaz.

## Geri alma

Bu değişiklik geri alınacaksa `MAX_STORAGE_CHARS`, `compactStoredEntries()` çağrısı, retention testleri ve bu belge kaldırılır. Conversation branch alternatives ile parent/root ancestry davranışları ayrı katman olarak korunabilir.
