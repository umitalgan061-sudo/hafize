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
- `bookmarkIds`: render edilmiş mesajların güvenli biçimde doğrulanmış kimlikleri.

Storage anahtarı `hafize.reading-focus.v1`'dir. En fazla 200 benzersiz mesaj kimliği tutulur. Geçersiz, boş, aşırı uzun veya izin verilmeyen karakter taşıyan kimlikler reddedilir.

`Yalnız` filtresinin `bookmarksOnly` durumu kalıcı storage'a yazılmaz. Bu filtre yalnız o an render edilmiş DOM görünümünü etkiler ve sayfa/kurulum yaşam döngüsü sonunda kapanır.

## Ağ ve backend sınırı

Reading Focus herhangi bir `fetch`, XHR, WebSocket, EventSource, sendBeacon veya connector çağrısı yapmaz. Yeni endpoint eklemez. NVIDIA, GitHub, Gmail, memory, schedule veya desktop-device yetkilerini değiştirmez.

Yer imi eklemek bir sunucu yazma işlemi değildir; yalnız bu tarayıcı profilindeki yerel görünüm tercihini değiştirir. Mesaj gövdesi hiçbir zaman yeni bir storage kaydına kopyalanmaz.

## Odak modu davranışı

Odak modu sidebar, utility rail ve sidebar toggle'ı yalnız CSS sınıfıyla gizler. DOM düğümleri silinmez ve konuşma durumu değiştirilmez. Moddan çıkıldığında normal düzen geri gelir.

Odak moduna geçiş açık kullanıcı tıklamasıyla yapılır. Durum aynı tarayıcıda sonraki açılış için saklanabilir. Sidebar açıksa odak moduna geçerken kapatılır; çıkışta sidebar otomatik açılmaz.

## Yer imi davranışı

Her render edilmiş mesaj için yıldız düğmesi eklenir. Yıldız durumu mesaj kimliği üzerinden eşlenir. Mesaj listesi uygulama tarafından yeniden render edilirse MutationObserver yalnız yeni DOM düğümlerini tekrar dekore eder; konuşma verisini değiştirmez.

Üst bardaki `★ N` düğmesi yalnız açık sohbette DOM'da bulunan yıldızlı mesajların sayısını gösterir. Tıklama, bu mesajlar arasında DOM sırasıyla döner ve hedefi ekranda ortalamaya çalışır.

`★ Yalnız` filtresi açıkken yer imi olmayan mesajlar DOM'dan silinmez; yalnız `reading-bookmark-filtered-out` sınıfıyla gizlenir. Böylece filtre kapatıldığında aynı mesaj düğümleri yeniden görünür olur. Açık sohbette hiç yer imi kalmazsa filtre fail-open kapanır.

Depoda başka sohbetlerden kalmış yer imi kimlikleri bulunabilir; bunlar açık sohbetin sayacına veya `Yalnız` filtresine dahil edilmez ve başka bir sohbet açılınca tekrar kullanılabilir.

## Erişilebilirlik

- Tüm kontroller gerçek `button` öğeleridir.
- Odak ve `Yalnız` düğmeleri `aria-pressed` ile durumlarını açıklar.
- Yer imi düğmesi ekle/kaldır eylemini erişilebilir adında belirtir.
- Yer imi gezgini ve `Yalnız` filtresi, açık sohbette yer imi yoksa disabled olur.
- Mobilde yer imi hedefi en az 40px tutulur.
- `prefers-reduced-motion` altında geçiş animasyonu kaldırılır ve gezinti smooth scroll yerine `auto` kullanır.
- `forced-colors` altında sistem renkleri ve görünür sınırlar korunur.

## Fail-safe davranış

Storage okunamazsa veya JSON bozuksa özellik boş durumla başlar. Storage yazılamazsa UI çalışmaya devam eder ancak tercih kalıcılaşmayabilir.

Geçersiz mesaj kimliği yer imi corpus'una alınmaz. Mesaj alanı veya topbar bulunmazsa `install()` no-op olarak `null` döner. `Yalnız` filtresi boş bir bookmark görünümünü kalıcılaştırmaz.

## Geri alma

Revert için `reading-focus.js`, `reading-focus.css`, ilgili loader/policy kayıtları, testler ve bu belge kaldırılır. Sohbet mesajları, server state, tool policy veya credential state üzerinde geri alınması gereken bir migrasyon yoktur.
