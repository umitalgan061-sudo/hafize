# Asistan yanıt araçları

## Kopyala

Yanıtın ham metnini panoya kopyalar.

Markdown işaretleri korunur.

Clipboard başarısızlığı yalnız status mesajı üretir.

## İndir

Yanıtı `hafize-yanit.md` adıyla yerel Markdown dosyasına dönüştürür.

İşlem Blob ve Object URL ile tarayıcı içinde yapılır.

Sunucuya upload yapılmaz.

## Alıntıla

Yanıtı composer alanına Markdown quote biçiminde ekler.

Her satırın başına `> ` eklenir.

Mevcut composer içeriği varsa iki yeni satırla ayrılır.

Composer'ın 12.000 karakter limiti korunur.

## Ham metin

Assistant yanıtının renderer görünümünü geçici olarak plain text yapar.

Tekrar tıklandığında renderer aktifse biçimli görünüm geri gelir.

Storage verisi değişmez.

## Yanıtı daralt

7.000 karakteri geçen assistant yanıtlarında görünür.

Daraltma yalnız CSS görünümünü etkiler.

Metin DOM'dan silinmez.

## Status

Aksiyon sonuçları `role=status` ve polite live region ile gösterilir.

## Keyboard

Tüm aksiyonlar gerçek `button` elementleridir.

Tab ile ulaşılabilir ve Enter/Space ile çalışır.

## Gizlilik

Kopyalama, indirme ve alıntılama yeni backend çağrısı başlatmaz.

## Güvenlik

Aksiyonlar model metnini HTML olarak yorumlamaz.

İndirme için oluşturulan Blob yalnız assistant metnini içerir.

## Fallback

Clipboard veya Blob API kullanılamazsa assistant yanıtının kendisi kaybolmaz.

## Mobil

Aksiyonlar `flex-wrap` ile dar ekranlarda birden fazla satıra düşebilir.
