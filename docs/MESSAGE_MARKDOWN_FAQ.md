# Markdown sık sorulan sorular

## Hafize tüm Markdown'ı destekliyor mu?

Hayır. Güvenli ve sınırlı bir alt küme desteklenir.

Amaç tam CommonMark uyumluluğu değil, okunabilir chat yanıtlarıdır.

## HTML çalışır mı?

Hayır. HTML güvenilir bir DOM kaynağı kabul edilmez.

Model `<script>` yazsa bile script çalıştırılmaz.

## Neden bazı linkler tıklanmıyor?

Yalnız http, https ve mailto protokolleri izinlidir.

Diğer şemalar güvenlik nedeniyle düz metin kalır.

## Markdown kapatılabilir mi?

Evet. Composer yardım satırındaki biçimlendirme kontrolü kullanılır.

Kapalıyken assistant yanıtları plain text görünür.

## Ayar cihazlar arasında senkronize olur mu?

Hayır. Tercih localStorage'da yereldir.

Backend veya analytics ile paylaşılmaz.

## Kod çalıştırılıyor mu?

Hayır. Kod blokları yalnız gösterilir.

Eval, Function ve benzeri execution API'leri yoktur.

## Kod nasıl kopyalanır?

Kod bloğundaki Kopyala düğmesi Clipboard API kullanır.

API kullanılamazsa hata status'u gösterilir.

## Uzun yanıt nasıl kısaltılır?

7.000 karakteri aşan assistant yanıtlarında Yanıtı daralt düğmesi çıkar.

Bu yalnız görünümü etkiler.

## Yanıtı dosyaya nasıl alırım?

İndir düğmesi local Markdown Blob oluşturur.

Dosya sunucuya gönderilmez.

## Yanıtı takip sorusuna nasıl eklerim?

Alıntıla düğmesi her satıra `> ` ekleyerek composer'a aktarır.

Composer maxlength korunur.

## Başlık özeti neden görünmüyor?

En az iki H1-H3 başlığı gerekir.

En fazla 20 başlık listelenir.

## Tablolar destekleniyor mu?

Basit Markdown tabloları desteklenir.

Sütun sayısı bounded'dır.

## Görev kutuları tıklanabilir mi?

Hayır. Model çıktısı olarak read-only gösterilir.

Uygulama state'i değiştirilemez.

## Streaming sırasında ne olur?

Yanıt delta'ları geldikçe renderer değişen source'u yeniden işler.

Aynı source ikinci kez geldiğinde DOM gereksiz yere değiştirilmez.

## PWA'da çalışır mı?

Evet. Markdown ve message action assetleri shell cache'e alınır.

## Veri kaybı olur mu?

Renderer yalnız geçici DOM oluşturur.

Ham conversation verisi korunur.

## Sorun olursa ne yapılır?

Önce biçimlendirmeyi kapatıp plain-text fallback'i doğrulayın.

Ardından runbook ve ilgili test paketine bakın.
