# Prompt Library Kullanıcı Kılavuzu

## Nerede bulunur?

Sohbet ekranındaki sağ yardımcı araçlar alanında **İstem kütüphanesi** kartını kullanabilirsiniz.

## İstem oluşturma

`＋ Yeni istem` düğmesine basın.

Başlık kısa ve tanımlayıcı olmalıdır.

İstem metni 8.000 karaktere kadar olabilir.

Etiketleri virgülle ayırın.

## Değişken kullanımı

Değişkeni `{{konu}}` biçiminde yazın.

`Kullan` seçildiğinde Hafize her değişken için değer ister.

Değer composer alanına yerleştirilir fakat otomatik gönderilmez.

Bu, gönderme öncesi prompt'u kontrol etmenizi sağlar.

## Arama

Arama kutusu başlık, içerik, etiket ve değişken isimlerinde çalışır.

Türkçe karakter duyarlılığı kullanıcıya göre doğal tutulur.

## Filtreleme

Etiket açılır menüsünden belirli bir konu grubunu seçebilirsiniz.

Favoriler filtresi yalnız yıldızlı kayıtları gösterir.

Her iki filtre arama ile birlikte kullanılabilir.

## Sıralama

Son güncellenen, favoriler önce, yeni oluşturulan ve alfabetik sıralamalar bulunur.

## Kopyalama ve çoğaltma

`Kopyala` yalnız prompt metnini panoya alır.

`Çoğalt` yeni id üretir, kullanım sayısını sıfırlar ve favori durumunu kapatır.

## Toplu seçim

Listede checkbox'larla en fazla 40 kayıt seçilebilir.

Seçilenler favorilenebilir veya onay sonrası silinebilir.

## İçe aktarma

JSON dosyası 1 MB sınırındadır.

Geçersiz dosya mevcut veriyi bozmaz.

Aynı id tekrar geldiğinde üzerine yazmak yerine yeni id oluşturulur.

## Dışa aktarma

Seçim varsa seçili kayıtlar dışa aktarılır.

Seçim yoksa mevcut görünümden sınırlı kayıt kümesi dışa aktarılır.

Dosya adı `hafize-prompt-library.json` olarak sabittir.

## Başlangıç seti

İlk kullanımda on örnek prompt otomatik hazırlanır.

Sonradan **Başlangıç seti** düğmesiyle eksik örnekler geri eklenebilir.

Kullanıcı kayıtları silinmez.

## Kısayol

`Ctrl/⌘ + Shift + P` prompt aramasını odaklar.

## Veri konumu

Prompt kayıtları yalnız bu cihazdaki `localStorage` alanında tutulur.

Hesaplar arasında otomatik senkronizasyon yoktur.
