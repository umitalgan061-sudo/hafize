# Message edit lifecycle boundary

Hafize'nin mesaj düzenleme özelliği kaynak sohbeti değiştirmeden yeni bir konuşma dalı üretir. Bu belge, bu UI controller'ının uzun yaşayan PWA/masaüstü oturumlarında hangi sahiplik ve teardown kurallarına uyması gerektiğini tanımlar.

## Sahiplik

- `#messages` yüzeyinin aynı anda yalnız bir message-edit controller sahibi olabilir.
- Sahiplik DOM içinde görünür bir düğmenin varlığına güvenmez; controller'a ait kapalı bir installation token ile doğrulanır.
- İkinci controller aynı yüzeyi sessizce devralamaz. İlk controller açıkça destroy olmadan yeni sahiplik kurulamaz.
- Controller dışarıdan sahipliğini kaybederse eski callback'ler storage, handoff, lineage event veya reload yan etkisi üretemez.

## Düzenleme kontrolleri

- Controller yalnız kendi oluşturduğu `Düzenle` düğmelerini ve listener'larını kaldırır.
- Host veya başka bir modül tarafından önceden sağlanan `.message-edit-btn` kontrolüne dokunulmaz.
- `data`/dataset marker controller tarafından değiştirilmişse destroy sırasında önceki değer exact restore edilir; marker önceden yoksa yeniden yok olur.
- Tek bir mesajın decorate adımı yarıda kalırsa button/listener/marker parçaları bırakılmaz.

## Stale callback karantinası

Destroy, ownership loss veya failed installation sonrasında:

- eski click callback'i yeni branch yaratamaz,
- canonical conversation storage'a yazamaz,
- session handoff hazırlayamaz veya tüketemez,
- lineage event yayınlayamaz,
- sayfa reload başlatamaz,
- stale MutationObserver yeni kontroller oluşturamaz.

Bu nedenle callback'in bir JavaScript closure olarak hâlâ erişilebilir olması yetki anlamına gelmez; her yan etki canlı controller ownership'iyle yeniden doğrulanır.

## Kaynak veriyi koruma

Lifecycle sertleştirmesi mevcut ürün sözleşmesini değiştirmez:

- composer'da gönderilmemiş taslak varsa düzenleme branch'i açılmaz,
- assistant stream devam ederken branch açılmaz,
- yeni branch yalnız düzenlenen user mesajından önceki bağlamı kopyalar,
- kaynak conversation persistence doğrulamasından sonra da mevcut olmalıdır,
- persistence doğrulanamazsa staged handoff temizlenir ve reload/lineage event üretilmez,
- model tercihi kopyalama best-effort kalır ve kaynak sohbeti silmez.

## Draft handoff

Draft handoff session-scoped ve tek kullanımlıktır. Yalnız:

- handoff süresi geçmemişse,
- conversation kimliği aktif sohbetle exact eşleşiyorsa,
- composer boşsa,
- assistant stream aktif değilse,
- controller canlı yüzey sahipliğini koruyorsa

composer'a uygulanabilir. Destroy edilmiş veya sahipliğini kaybetmiş controller handoff'u tüketemez.

## PWA

`message-edit.js` shell cache içinde bulunduğundan davranış değişikliği cache sürümünü de ilerletir. Böylece eski lifecycle kodu ile yeni controller'ın aynı PWA shell içinde karışması önlenir.
