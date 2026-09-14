# Prompt Library Kullanıcı Kılavuzu

## Nerede?

Sohbet ekranının yardımcı araçlar rail'inde **İstem kütüphanesi** kartı bulunur.

## Yeni istem

`＋ Yeni istem` düğmesine basın. Başlık, istem metni ve virgülle ayrılmış etiketleri girin. İstem metninde `{{konu}}` gibi alanlar kullanabilirsiniz.

## Kullan

Bir kayıtta `Kullan` seçildiğinde değişkenler sırayla sorulur. Değerler mesaj alanına yerleştirilir ve gönderme kullanıcı kontrolünde kalır; istem otomatik gönderilmez.

## Ara

Arama başlık, gövde, etiket ve değişken adlarını tarar. Arama durumu cihazda saklanır.

## Favori

Yıldız düğmesi sık kullanılan istemleri öne çıkarır. `★ Favoriler` filtresi yalnız favorileri listeler.

## Etiket ve sıralama

Etiket seçimi belirli bir konu kümesine daraltır. Son güncellenen, favori, yeni ve alfabetik sıralamalar desteklenir.

## Düzenle

`Düzenle` ile başlık, metin veya etiketleri değiştirebilirsiniz. Değişken listesi otomatik olarak metinden çıkarılır.

## İçe aktar

Ayar veya eski cihazdan alınan JSON dosyasını `İçe aktar` ile yükleyin. Dosya 1 MB'tan büyük olamaz. Aynı kayıt kimliği mevcut bir kaydın üstüne yazılmaz; yeni kimlik oluşturulur.

## Dışa aktar

Seçili kayıtlar varsa yalnız onlar, seçim yoksa mevcut görünüm dışa aktarılır. Çıktı `hafize-prompt-library.json` adlı JSON dosyasıdır.

## Kısayol

`Ctrl/⌘ + Shift + P` istem aramasına odaklanır. Kısayol tarayıcıdaki mevcut sohbet kısayollarıyla çakışmaması için `Shift` ile başlar.

## Veri konumu

Kayıtlar yalnız bu cihazdaki `localStorage` alanında tutulur. Sohbet geçmişiyle aynı storage anahtarını kullanmaz.
