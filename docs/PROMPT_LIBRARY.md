# Hafize Prompt Library

Prompt Library, tekrar kullanılan istemleri cihaz üzerinde saklamak ve tek tıkla composer alanına aktarmak için kullanılan yerel çalışma alanıdır.

## Amaç

Kullanıcı aynı talimatı tekrar tekrar yazmak yerine kendi istemlerini kaydedebilir, düzenleyebilir, etiketleyebilir, favorileyebilir ve yeniden kullanabilir.

## Kayıt modeli

Her kayıt; benzersiz `id`, başlık, gövde, etiket listesi, gövdeden çıkarılmış değişkenler, favori durumu, kullanım sayısı ve oluşturulma/güncellenme zamanlarını taşır.

Kayıt sayısı 120 ile sınırlıdır. Gövde 8.000 karakter, başlık 100 karakterdir.

## Değişkenler

`{{konu}}` veya `{{dil}}` biçimi değişken olarak tanınır. Değişken adları 32 karakterle ve kayıt başına 12 adetle sınırlıdır.

Kullanım sırasında her değişken için değer alınır. Değer 1.000 karakterle sınırlandırılır ve doğrudan composer textarea değerine yazılır.

## Filtreleme

Arama başlık, gövde, etiket ve değişkenleri tarar. Etiket filtresi ve favori filtresi birlikte kullanılabilir.

Sıralamalar son güncellenen, favoriler önce, yeni oluşturulan ve başlık sıralamasıdır.

## Toplu işlemler

En fazla 40 kayıt aynı anda seçilebilir. Seçilen kayıtlar favorilenebilir veya kullanıcı onayı sonrası silinebilir.

## Import / export

JSON import 1 MB ile sınırlıdır. Import normalizasyonundan sonra mevcut id'ler overwrite edilmez; çakışan kayıt yeni id alır.

Export yalnız yerel Blob kullanır. Seçim varsa seçilenler; yoksa mevcut görünümdeki ilk 40 kayıt dışa aktarılır.

## Saklama

Kayıtlar `hafize.prompt-library.v1`, görünüm durumu `hafize.prompt-library.v1.state` anahtarında tutulur. Sohbet geçmişi anahtarına dokunulmaz.

## PWA

Prompt library'nin CSS ve JavaScript dosyaları shell cache'e dahildir. Service worker sürümü asset değişiminde artırılır.

## Kapsam dışı

Uzak senkronizasyon, prompt paylaşım pazarı, ekip kütüphanesi, backend database ve connector yazma yetkileri bu sürümde yoktur.
