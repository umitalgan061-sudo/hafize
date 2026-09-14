# Prompt Library QA

## Temel akış

1. Uygulamayı yeni kullanıcı olarak aç.
2. İstem kütüphanesinin göründüğünü doğrula.
3. Başlangıç setinde 10 kayıt bulunduğunu doğrula.
4. Bir kayıt üzerinde `Kullan` seç.
5. Değişken sorularını doldur.
6. Composer'ın doldurulduğunu ama gönderimin gerçekleşmediğini doğrula.

## Düzenleme

Bir starter istemini düzenle.

Başlığı değiştir.

Etiket ekle.

Gövdedeki değişkenleri değiştir.

Kaydet.

Liste preview'sinin yeni veriyi gösterdiğini doğrula.

## Arama

Başlık üzerinden eşleşme testi yap.

Gövde içinde kelime testi yap.

Etiket üzerinden filtre yap.

Değişken adı üzerinden filtre yap.

Arama + favori filtresini birlikte kullan.

Arama + tag filtresini birlikte kullan.

## Toplu işlemler

40 kayıt seçmeyi dene.

41. kaydın seçilmediğini doğrula.

Seçimi temizle.

Birden fazla kaydı favorile.

Toplu silme öncesi confirm geldiğini doğrula.

Cancel seçildiğinde kayıtların korunmasını doğrula.

## Import / export

Geçerli JSON içe aktar.

Bozuk JSON dene.

1 MB üstü dosya dene.

Aynı id'li kayıt import et.

Mevcut kayıt overwrite olmadığını doğrula.

Seçili kayıtları export et.

Seçim yokken görünür kayıtları export et.

## Storage

`localStorage` boş olduğunda fallback kontrol et.

Bozuk JSON storage değeriyle açılış kontrol et.

Write exception ile UI crash olmadığını doğrula.

Conversation history key'inin değişmediğini kontrol et.

## Güvenlik

Prompt title içine `<script>` yaz.

Prompt body içine event attribute içeren markup yaz.

Variable değerine HTML yaz.

Hiçbirinin execute olmadığını doğrula.

Clipboard başarısızlığında status gösterildiğini kontrol et.

## PWA

Service worker cache'de dört prompt library JS/CSS asset'ini doğrula.

Cache version değerinin güncel olduğunu kontrol et.

API requestlerinin network-only kaldığını doğrula.

## Responsive

700px altı görünümde toolbar'ın tek kolona düştüğünü kontrol et.

Uzun title ve body'nin taşmadığını kontrol et.

Forced colors görünümünde focus ve border'ların görünür olduğunu kontrol et.
