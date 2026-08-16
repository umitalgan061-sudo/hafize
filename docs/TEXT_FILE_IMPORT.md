# Yerel metin dosyası ekleme sözleşmesi

`public/text-file-import.js`, composer yanındaki mevcut **Dosya ekle** kontrolünü yalnız küçük metin ve kod dosyalarını yerel olarak yazara eklemek için etkinleştirir.

## Kullanıcı kontrolü

Dosya seçici yalnız kullanıcının görünür `Dosya ekle` düğmesine basmasıyla açılır. Seçilen dosya hiçbir zaman otomatik gönderilmez; içerik önce composer'a eklenir ve kullanıcı normal gönderme kontrolüyle açıkça onaylar.

## Veri sınırı

- Tek dosya en fazla 128 KiB olabilir.
- Yalnız allowlist uzantılar veya metin tabanlı MIME türleri kabul edilir.
- Dosya içeriği tarayıcının `File.text()` API'siyle yerelde okunur.
- CRLF/CR satır sonları LF'ye çevrilir ve NUL karakterleri çıkarılır.
- Dosya adı kontrol karakterlerinden ve yol ayraçlarından temizlenir.
- İçerik `--- Dosya: ... ---` / `--- Dosya sonu ---` sınırlarıyla composer'a eklenir.
- Mevcut taslak korunur; dosya taslağın sonuna iki satır sonuyla eklenir.
- Sonuç 12.000 karakter composer sınırına sığmıyorsa hiçbir kısmi ekleme yapılmaz.

## Güvenlik

Bu özellik upload endpoint'i açmaz. `fetch`, XHR, WebSocket, `sendBeacon`, clipboard, local/session storage, form submit veya tool çağrısı kullanmaz. Secret/credential dosyaları için özel geniş okuma yetkisi verilmez; kabul yalnız dar metin/kod uzantı sözleşmesine bağlıdır.

## Erişilebilirlik

İşlem sonucu görünür/polite status bölgesinde duyurulur. Başarılı eklemeden sonra odak composer'a döner ve caret metnin sonunda kalır.

## PWA

`/text-file-import.js` same-origin shell asset'tir ve cache v42 kapsamındadır. `/api/*` network-only kalır.

## Geri alma

Controller, loader satırı, PWA asset kaydı, testler ve bu belge kaldırılırsa mevcut composer ve attachment placeholder davranışı geri gelir; backend sohbet veya tool mimarisi etkilenmez.
