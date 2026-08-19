# Reading Focus & Bookmarks Contract

## Amaç

Bu katman uzun Hafize sohbetlerini daha rahat okumayı sağlar. Kullanıcı üç açık eylem kazanır:

- `Odak`: sohbet alanını genişletir, sidebar ve utility rail'i geçici olarak gizler.
- `Yer imi`: belirli bir mesajı yıldızlar ve aynı açık sohbette yıldızlı mesajlar arasında gezinmeyi sağlar.
- `Yalnız`: yalnız açık sohbetteki yer imli mesajları geçici olarak görünür bırakır.

## Veri sınırı

Bu özellik mesaj metnini, başlığı, model adını, ajan bilgisini, tool activity içeriğini veya kişisel bellek verisini saklamaz.

Kalıcı yerel durum yalnız şunlardan oluşur:

- `focusMode`: boolean.
- `bookmarkIds`: conversation kimliği ile message kimliğinin birlikte doğrulanmış scoped anahtarları.

Storage anahtarı `hafize.reading-focus.v1`'dir. En fazla 200 benzersiz scoped yer imi tutulur. Scoped anahtar biçimi `conversationId|messageId` şeklindedir; `|` karakteri canonical kimlik alfabelerinde bulunmadığından iki parça deterministik ayrılır. Geçersiz, boş, aşırı uzun veya izin verilmeyen karakter taşıyan kimlikler reddedilir.

Bu kapsam özellikle aynı `messageId` iki farklı conversation içinde bulunabildiğinde önemlidir. Bir sohbetteki yer imi başka bir conversation'daki aynı ID'li mesaja uygulanmaz.

`Yalnız` filtresinin `bookmarksOnly` durumu kalıcı storage'a yazılmaz. Bu filtre yalnız o an render edilmiş DOM görünümünü etkiler ve sayfa/kurulum yaşam döngüsü sonunda kapanır.

## Legacy migration

Önceki sürüm yalnız çıplak `messageId` değerleri saklıyordu. Bu değerler ilk canonical compaction sırasında conversation kapsamına taşınır.

- Legacy message ID yalnız **tek bir canonical conversation/message** ile eşleşiyorsa scoped anahtara migrate edilir.
- Aynı legacy ID birden fazla conversation içinde bulunuyorsa eşleşme ambiguous kabul edilir ve hiçbir conversation'a bağlanmaz.
- Canonical store/guard kullanılamıyorsa migration veya destructive pruning yapılmaz; state fail-closed bellekte tutulur.
- Scoped state canonical hale geldikten sonra storage'a yalnız scoped anahtarlar yazılır.

Bu yaklaşım eski bir yer imini yanlış conversation'a tahmin ederek taşımak yerine veri sınırını korur.

## Conversation lifecycle

Scoped bookmark'lar canonical conversation/message setine karşı bounded biçimde compact edilir. Silinen, geçmiş temizleme ile kaldırılan veya retention sonucu düşen message anahtarları storage'da orphan olarak birikmez.

`Temizle → Geri al` akışındaki RAM companion snapshot yalnız canonical scoped bookmark anahtarlarını taşır. Mesaj metni, başlık, token, credential, owner ID veya trace ID snapshot'a girmez. Global `focusMode` conversation undo kapsamına alınmaz; kullanıcının güncel focus tercihi korunur.

## Cross-tab reconciliation

`focusMode` ve bookmark listesi aynı localStorage kaydında bulunsa da kullanıcı eylemleri alan-bazlı uygulanır. Bookmark tıklaması önce storage'daki en güncel state'i okur, yalnız hedef scoped bookmark'ı değiştirir ve güncel `focusMode` değerini korur. Odak modu tıklaması da yalnız `focusMode` değerini değiştirip güncel bookmark listesini korur.

Başarılı yerel kullanıcı eylemleri persistent şemaya yeni metadata eklemeden, yalnız oturum RAM'inde bounded mutation intent olarak tutulur. Başka sekmeden gelen storage transition yerel intent'i `after → before` geri götürürken aynı anda başka bağımsız bir alanı da değiştiriyorsa bu stale-snapshot collateral olarak değerlendirilebilir ve yerel intent remote state üzerine bounded biçimde replay edilir.

Aynı bookmark veya aynı `focusMode` alanını doğrudan tersine çeviren tek-alan remote transition gerçek conflict kabul edilir; remote değer kazanır. Replay sayısı intent başına en fazla iki olduğundan storage-event ping-pong kalıcı hale gelemez.

Conversation lifecycle daha güçlü bir sınırdır: pending bookmark'ın conversation/message anahtarı canonical setten silinmişse mutation RAM'den düşürülür ve bookmark hiçbir koşulda yeniden diriltilmez. Gecikmiş bir storage event geldiğinde event payload'ı mevcut storage değerinden eskiyse controller güncel storage state'ini authoritative kabul eder ve eski event'i geri yazmaz.

## Aktif conversation kimliği

Render edilmiş mesajın bookmark anahtarı yalnız aktif conversation kimliği güvenle çözülebiliyorsa oluşturulur.

- Organizer satır kimliği mevcutsa `data-conversation-organize-id` authoritative kabul edilir.
- Organizer henüz satırları etiketlemediyse yalnız tüm satırlar etiketsizken canonical source-order startup fallback kullanılabilir.
- Mixed tagged/untagged durum, birden fazla active row veya geçersiz conversation ID fail-closed davranır; bookmark düğmesi yanlış conversation'a yazmak yerine devre dışı kalır.
- Message ve conversation-list MutationObserver'ları conversation switch ve organizer reorder/tag değişikliklerinde bookmark görünümünü tekrar doğrular.

## Ağ ve backend sınırı

Reading Focus herhangi bir `fetch`, XHR, WebSocket, EventSource, sendBeacon veya connector çağrısı yapmaz. Yeni endpoint eklemez. NVIDIA, GitHub, Gmail, memory, schedule veya desktop-device yetkilerini değiştirmez.

Yer imi eklemek bir sunucu yazma işlemi değildir; yalnız bu tarayıcı profilindeki yerel görünüm tercihini değiştirir. Mesaj gövdesi hiçbir zaman yeni bir storage kaydına kopyalanmaz.

## Odak modu davranışı

Odak modu sidebar, utility rail ve sidebar toggle'ı yalnız CSS sınıfıyla gizler. DOM düğümleri silinmez ve konuşma durumu değiştirilmez. Moddan çıkıldığında normal düzen geri gelir.

Odak moduna geçiş açık kullanıcı tıklamasıyla yapılır. Durum aynı tarayıcıda sonraki açılış için saklanabilir. Sidebar açıksa odak moduna geçerken kapatılır; çıkışta sidebar otomatik açılmaz.

## Yer imi davranışı

Her render edilmiş mesaj için yıldız düğmesi eklenir. Yıldız durumu aktif conversation + mesaj kimliği üzerinden eşlenir. Mesaj listesi uygulama tarafından yeniden render edilirse MutationObserver yeni DOM düğümlerini tekrar dekore eder ve mevcut düğmelerin scoped durumunu yeniden doğrular; konuşma verisini değiştirmez.

Üst bardaki `★ N` düğmesi yalnız açık sohbette DOM'da bulunan yıldızlı mesajların sayısını gösterir. Tıklama, bu mesajlar arasında DOM sırasıyla döner ve hedefi ekranda ortalamaya çalışır.

`★ Yalnız` filtresi açıkken yer imi olmayan mesajlar DOM'dan silinmez; yalnız `reading-bookmark-filtered-out` sınıfıyla gizlenir. Böylece filtre kapatıldığında aynı mesaj düğümleri yeniden görünür olur. Açık sohbette hiç yer imi kalmazsa filtre fail-open kapanır.

Başka sohbetlere ait scoped bookmark'lar açık sohbetin sayacına veya `Yalnız` filtresine dahil edilmez; yalnız kendi conversation'ları yeniden açıldığında görünür olur.

## Erişilebilirlik

- Tüm kontroller gerçek `button` öğeleridir.
- Odak ve `Yalnız` düğmeleri `aria-pressed` ile durumlarını açıklar.
- Yer imi düğmesi ekle/kaldır eylemini erişilebilir adında belirtir.
- Conversation kimliği doğrulanamıyorsa yer imi düğmesi disabled olur ve nedeni erişilebilir ad/title içinde belirtilir.
- Yer imi gezgini ve `Yalnız` filtresi, açık sohbette yer imi yoksa disabled olur.
- Mobilde yer imi hedefi en az 40px tutulur.
- `prefers-reduced-motion` altında geçiş animasyonu kaldırılır ve gezinti smooth scroll yerine `auto` kullanır.
- `forced-colors` altında sistem renkleri ve görünür sınırlar korunur.

## Fail-safe davranış

Storage okunamazsa veya JSON bozuksa özellik boş durumla başlar. Storage yazılamazsa UI çalışmaya devam eder ancak tercih kalıcılaşmayabilir ve başarısız yazım replay intent'i oluşturmaz.

Geçersiz kimlik bookmark corpus'una alınmaz. Ambiguous legacy ID yanlış conversation'a tahmin edilmez. Mesaj alanı veya topbar bulunmazsa `install()` no-op olarak `null` döner. `Yalnız` filtresi boş bir bookmark görünümünü kalıcılaştırmaz.

## Geri alma

Revert için scoped bookmark değişikliği ve ilgili test/policy güncellemeleri geri alınabilir. Persistent key değişmediği için ayrı storage key cleanup gerekmez; yeni scoped değerler eski sürüm tarafından geçersiz ID olarak görülür ve yanlış mesaja uygulanmaz.
