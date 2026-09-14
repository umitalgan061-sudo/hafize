# Chat Markdown Operasyon Runbook

## Yayın öncesi

`public/chat-markdown.js`, `public/chat-markdown.css` ve `public/index.html` birlikte kontrol edilir. Service worker cache revision yeni shell assetleri içerecek şekilde artırılmalıdır.

## Hızlı doğrulama

Önce syntax ve precheck çalıştırılır. Ardından Markdown'a özel parser, security, rendering, PWA ve source-contract testleri çalıştırılır. Tam `npm run check` filtresiz olarak çalıştırılır.

## Smoke senaryoları

Yeni sohbet aç, kısa bir asistan yanıtı al ve normal paragraf gördüğünü doğrula. Başlıklı yanıt, liste, tablo ve fenced code üret; ekran taşması olmadığını kontrol et. Kod kopyalama düğmesine bas; yalnız code block içeriğinin panoya gittiğini kontrol et.

Aynı yanıtta kötü URL ve HTML benzeri metin üret; linkin tıklanabilir olmadığını ve `<img>` benzeri metnin metin olarak kaldığını kontrol et.

Mobil genişlikte geniş tablo ve uzun kod satırı aç; sayfanın yatay taşmadığını, code/table kendi kaydırma kabında kaldığını doğrula. Reduced-motion ve forced-colors ortamlarında kontrollerin erişilebilir olduğunu kontrol et.

## Streaming

Mevcut `app.js` streaming akışı mesaj düğümünün text content'ini değiştirir. Observer yeni değişikliği microtask içinde yakalar. Bu yüzden parser her küçük fragment'ta kendi sonsuz döngüsüne girmemelidir; `markdownWriting` ve kaynak karşılaştırması re-entrant çizimi engeller.

Kapanmamış fence streaming sırasında kabul edilir. Sonraki delta geldiğinde kaynak değiştiği için renderer bloğu yeniden kurar.

## Arıza belirtileri

Markdown çalışmıyorsa ilk kontrol asset'in index'e ve shell cache'e eklenip eklenmediğidir. Biçimlendirme yalnız ilk yanıtta görünüyorsa observer lifecycle kontrol edilir. Kod kopyalama çalışmıyorsa Clipboard API ve browser permission davranışı kontrol edilir.

PWA offline çalışmıyorsa cache revision, `SHELL_ASSETS`, dosya varlığı ve `/api/*` network-only politikasını kontrol et.

## Geri alma

Özellik bağımsız olduğu için index'teki Markdown stylesheet/script referansları ve shell cache girdileri geri alınabilir. `app.js` ve sohbet storage şeması rollback gerektirmez.
