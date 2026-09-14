# Prompt Library

Prompt Library, Hafize içindeki tekrar kullanılan istemleri cihaz üzerinde saklayan yerel bir çalışma alanıdır.

## Amaç

Kullanıcının sık kullandığı araştırma, kodlama, yazma, planlama ve karar istemlerini yeniden yazmadan kullanmasını sağlamak.

## Veri

Ana kayıt anahtarı `hafize.prompt-library.v1`, filtre/sıralama durumu ise `hafize.prompt-library.v1.state`.

Her kayıt başlık, gövde, etiket, otomatik çıkarılan değişkenler, favori bilgisi, kullanım sayısı ve zaman damgaları taşır.

Kayıtlar yerel `localStorage` ile tutulur. Server endpoint'i, hesap senkronizasyonu veya üçüncü taraf depolama eklenmez.

## Kullanım

Kullanıcı kütüphane kartından arama yapar, etiket filtresi veya favori filtresi uygular, sıralamayı değiştirir ve bir istemi `Kullan` ile mesaj alanına aktarır.

`{{değişken}}` biçimindeki alanlar kullanım sırasında kullanıcıdan alınır ve yalnız ilgili istemin kopyasına uygulanır.

İstem kullanıldığında `useCount` artar. Bu istatistik yalnız cihazdaki kayıtta tutulur.

## Düzenleme

Başlık 100 karakter, istem gövdesi 8.000 karakter, etiket 24 karakter ve 8 adet, değişken 32 karakter ve 12 adettir.

Kaydetme sırasında boş gövde reddedilir. Değişken listesi istem gövdesinden yeniden hesaplanır; böylece eski metadata ile yeni gövde ayrışmaz.

## Arama ve sıralama

Arama başlık, gövde, etiket ve değişken adlarını kapsar. Arama 120 karakterle sınırlıdır.

Sıralamalar son güncellenen, favoriler, yeni oluşturulan ve başlığa göre seçeneklerine sahiptir.

## Toplu işlemler

Görünen kayıtlar seçim kutularıyla seçilebilir. Seçilen kayıtlar favorilere alınabilir veya kullanıcı onayı sonrası topluca silinebilir.

Dışa aktarma seçili kayıtları, seçim yoksa mevcut görünümü kullanır ve JSON olarak cihazdan indirir.

## PWA

`prompt-library.js` ve `prompt-library.css` shell cache içinde tutulur. Service worker sürümü her shell listesi değişiminde artırılır.

## Kapsam dışı

Hesaplar arası senkronizasyon, uzaktan prompt paylaşımı, public prompt galerisi, otomatik model seçimi ve backend veri tabanı bu sürümün kapsamında değildir.
