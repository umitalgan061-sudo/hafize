# Chat Markdown Mimari Kararları

## Neden bağımsız modül?

Sohbet state'i `public/app.js` tarafından sahipleniliyor. Streaming, mesaj düzenleme ve retry gibi akışları aynı dosyada yeniden kurmak yerine Markdown yalnız görünüm katmanında tutulur. Bu ayrım, model çıktısının biçimlendirilmesini conversation storage şemasından ayırır.

## Neden tam Markdown kütüphanesi yok?

Hafize'nin gereksinimi sınırlı ve güvenli bir alt kümedir. Yeni üçüncü taraf bağımlılık, bundle maliyeti ve güvenlik inceleme yüzeyi eklemeden yeterli biçimlendirme yerel parser ile sağlanır. Desteklenen sözdizimi özellikle belgelemeye uygundur ve sınırlandırılabilir.

## Neden h3'ten başlıyor?

Uygulamanın document outline'ında h1/h2 zaten uygulamaya aittir. Modelin `#` başlığı bütün sayfanın ana başlığını ele geçirmemelidir. Parser en yüksek modeli h3'e indirger.

## Neden Observer?

`app.js` mevcut mesajı önce düz metin olarak oluşturabilir, sonra streaming delta'ları doğrudan içerik düğümüne yazabilir. MutationObserver, yeni ve güncellenmiş asistan içeriklerini tek yerde biçimlendirir. Kaynağın değişmediği durumlarda tekrar render yoktur.

## Neden bounded parser?

Model çıktısı teorik olarak çok uzun veya kötü biçimlendirilmiş olabilir. Parser her veri boyutını sınırsız işlememelidir. Input, block, list, table, inline ve code limitleri ayrı tutulur; inline tarama özellikle uzun satırları düz metne düşürür.

## Neden URL allowlist?

Bir model bağlantı metni üretebilir ama bunun tıklanabilir hedefi güvenilir kabul edilemez. Absolute URL parse edilir ve yalnız HTTP(S)/mailto kabul edilir. `javascript:` ve `data:` gibi şemalar UI navigation yetkisine dönüşemez.

## Neden tablo scroll'u?

Desktop'ta geniş teknik tablolar faydalıdır; mobilde aynı tablo viewport'u zorlayabilir. Table wrapper kendi yatay scroll alanını taşır. Böylece sohbet genel layout'u bozulmaz.

## Neden kullanıcı mesajları plain text?

Kullanıcının kendi metnini Markdown'a çevirmek UX açısından gereksizdir ve input ile output davranışını birbirine karıştırır. Özellik yalnız asistan mesajlarına uygulanır.

## Kapsam dışı

HTML üretimi, raw HTML blokları, image embedding, iframe, script, form, remote fetching, syntax highlighting kütüphanesi ve server-side Markdown dönüşümü kapsam dışıdır.
