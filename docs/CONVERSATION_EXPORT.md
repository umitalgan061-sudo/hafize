# Aktif sohbet dışa aktarma sözleşmesi
`public/conversation-export.js`, yalnız kullanıcının ekranda açık olan sohbetini isteğe bağlı Markdown veya düz metin dosyası olarak dışa aktarır.
## Kullanıcı kontrolü
Üst bardaki görünür `Sohbeti dışa aktar` düğmesi önce bir seçim penceresi açar.
Dosya ancak kullanıcı `Markdown (.md)` veya `Düz metin (.txt)` seçeneğine açıkça bastığında hazırlanır.
Pencere `Escape`, arka plan tıklaması veya `Vazgeç` ile kapanır.
Kapanışta odak, pencereyi açan kontrole geri döner.
Tab ve Shift+Tab odağı açık pencerenin içinde tutar.
## Veri kapsamı
Dışa aktarım yalnız `#messages` içindeki `.message` öğelerini okur.
Her mesajdan yalnız `.content` düz metni alınır.
Rol yalnız `user` veya `assistant` ise kabul edilir.
Araç etkinliği, trace kimliği, agent metadata, mesaj kimliği ve başka sohbetler dosyaya eklenmez.
Aktif sohbet başlığı yalnız dosya adı ve belge başlığı için görünür aktif sohbet satırından okunur.
## Sınırlar
En fazla 500 görünür mesaj işlenir.
Tek mesaj en fazla 256 KiB karakter olabilir.
Toplam dışa aktarılan içerik en fazla 1 MiB karakter olabilir.
Sınır aşılırsa işlem fail-closed biçimde durur ve dosya oluşturulmaz.
CRLF/CR satır sonları LF biçimine normalize edilir.
NUL karakterleri metinden çıkarılır.
## Dosya adı güvenliği
Dosya adı en fazla 80 karakterlik görünür sohbet başlığından türetilir.
Kontrol karakterleri temizlenir.
`\\ / : * ? " < > |` gibi dosya sistemi açısından sorunlu karakterler `-` ile değiştirilir.
Başlık boş kalırsa `Hafize sohbeti` kullanılır.
Markdown biçimi `.md`, düz metin biçimi `.txt` uzantısı kullanır.
## İndirme sınırı
Dosya yalnız tarayıcının yerel `Blob` ve object URL API'leri ile hazırlanır.
Object URL işlem sonunda her durumda revoke edilir.
Geçici indirme bağlantısı DOM'dan hemen kaldırılır.
Bağlantıda `rel=noopener` kullanılır.
Tarayıcı bu API'leri sunmuyorsa işlem yapılmaz.
## Güvenlik ve gizlilik
Controller `fetch`, XHR, WebSocket veya `sendBeacon` çağırmaz.
`localStorage`, `sessionStorage` veya cookie okumaz/yazmaz.
Clipboard kullanmaz.
Form submit veya composer submit tetiklemez.
Tool çağrısı yapmaz ve backend endpoint açmaz.
Dışa aktarım mevcut sohbet verisini değiştirmez veya silmez.
## Erişilebilirlik
Seçim penceresi `role=dialog` ve `aria-modal=true` kullanır.
Başlık ve açıklama `aria-labelledby` / `aria-describedby` ile bağlanır.
Durum mesajları `role=status` ve `aria-live=polite` ile duyurulur.
Mobil görünümde seçenekler tek sütuna iner.
## PWA
`/conversation-export.js` same-origin shell asset olarak cache listesine eklenir.
Shell cache sürümü v37'dir.
`/api/*` istekleri network-only kalır ve bu özellik servis worker davranışını genişletmez.
## Geri alma
Bu özellik geri alınırsa controller, loader satırı, PWA asset kaydı, testler ve bu belge kaldırılır.
Mevcut sohbet kopyalama, arama, Markdown render ve kod bloğu özellikleri etkilenmez.
