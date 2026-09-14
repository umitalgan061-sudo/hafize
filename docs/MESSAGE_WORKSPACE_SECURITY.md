# Mesaj Çalışma Alanı Güvenlik Sözleşmesi

## Tehdit modeli

Mesaj çalışma alanı, model çıktısını ve kullanıcı mesajlarını güvenilmeyen metin olarak ele alır.

Bir saldırganın mesaj içine HTML, JavaScript, URL, token adı veya çok uzun veri koyabileceği varsayılır.

Bir başka sekmenin aynı origin üzerinde storage olayları üretebileceği varsayılır.

Tarayıcı `localStorage` içeriğinin kullanıcı tarafından geliştirici araçlarıyla değiştirilebileceği varsayılır.

Bu nedenle storage içeriği hiçbir zaman yetki kanıtı olarak kullanılmaz.

## Veri sınırları

Record kimliği 120 karakterle sınırlandırılır.

Konuşma kimliği 120 karakterle sınırlandırılır.

Mesaj kimliği 120 karakterle sınırlandırılır.

Not 600 karakterle sınırlandırılır.

Etiketler 24 karakter ve 8 adet ile sınırlandırılır.

Arama 120 karakterle sınırlandırılır.

Kayıt sayısı 240 ile sınırlandırılır.

Dışa aktarma 100 kayıtla sınırlandırılır.

Aşırı veri DOM içine sınırsız biçimde taşınmaz.

## HTML enjeksiyonu

Kullanıcı mesaj metni `textContent` ile gösterilir.

Notlar `textContent` ile gösterilir.

Etiket özetleri `textContent` ile gösterilir.

Panel sonuçları DOM API ile oluşturulur.

`innerHTML` kullanılmaz.

`outerHTML` kullanılmaz.

`insertAdjacentHTML` kullanılmaz.

`document.write` kullanılmaz.

Bu sözleşme model yanıtının içerdiği `<script>` benzeri metnin çalıştırılmasını engeller.

## Network sınırı

Mesaj çalışma alanı backend'e istek göndermez.

`fetch` çağrısı yoktur.

`XMLHttpRequest` yoktur.

`WebSocket` yoktur.

`/api/` erişimi yoktur.

Authorization başlığı yoktur.

Bearer token yoktur.

`document.cookie` değeri okunmaz.

Environment değişkeni okunmaz.

Secret veya API anahtarı depolayan özel alan yoktur.

## Storage sınırı

Tek ana storage anahtarı `hafize.message-workspace.v1`'dir.

Görünüm durumu ayrı bir `state` uzantısında tutulur.

Conversation storage anahtarı değiştirilmez.

Conversation silme yetkisi bu modüle verilmez.

History temizleme işlemi bu modül tarafından çağrılmaz.

Storage okuması başarısız olduğunda boş ve güvenli varsayılan kullanılır.

Storage yazması başarısız olduğunda kullanıcıya durum mesajı gösterilir.

## Cross-tab davranışı

`storage` olayı yalnız ilgili anahtar değiştiğinde dikkate alınır.

Aynı origin dışındaki kaynakların payload'ı güvenilir kabul edilmez.

Gelen kayıtlar normalize edilir.

Aynı kayıt id'si ikinci kez kabul edilmez.

Seçim listesi 100 ile sınırlandırılır.

## Dışa aktarma

Export yalnız yerel JSON üretir.

İçerik kullanıcı cihazından çıkmaz.

Blob MIME tipi `application/json`'dır.

Object URL işlem sonrasında revoke edilir.

Export sayısı 100 ile sınırlandırılır.

Dosya adı konuşma içeriğinden üretilmez.

Dosya adı yalnız sabit prefix ve tarih bileşeninden oluşur.

## Geri bildirim

Geri bildirim yalnız `up`, `down` veya boş durum alabilir.

Bir butona ikinci kez basmak durumu temizler.

Geri bildirim backend'e gönderilmez.

Kullanıcı davranışı model sağlayıcısına doğrudan aktarılmaz.

## Notlar ve etiketler

Notlar yazım biçimiyle saklanır ve HTML değildir.

Satır sonları normalize edilir.

Etiketler trim edilir.

Başındaki `#` işaretleri kaldırılır.

Aynı etiket tekrarları tekilleştirilir.

Etiket limiti aşıldığında ilk sekiz normalize edilmiş etiket korunur.

## Lifecycle

DOM değiştiğinde eklentiler yeniden uygulanır.

Observer yalnız `#messages` ağacını izler.

Global document subtree gözlemlenmez.

Periyodik cleanup konuşma içi eski metadata'yı sınırlar.

Listener'lar tek kez kurulur.

Storage değişikliğinde panel yeniden çizilir.

## PWA

Yeni dosyalar shell cache içine eklenir.

API isteği cache'e alınmaz.

Yeni özellik offline shell tarafından sunulsa dahi hiçbir secret offline depolanmaz.

## Test

Security source testi network capability yokluğunu doğrular.

Adversarial testi uzun değerleri doğrular.

Prototype property'lerinin own property olmadığı senaryolar ayrıca sınanır.

Export quota test edilir.

HTML string API'lerinin kullanılmadığı kaynak düzeyinde doğrulanır.

## Geri alma

Özellik tamamen istemci tarafıdır.

Geri alma, index'ten iki script ve bir stylesheet referansının çıkarılması ve üç yeni dosyanın kaldırılmasıyla yapılabilir.

Mevcut sohbet geçmişi şemasına migration gerekmez.
