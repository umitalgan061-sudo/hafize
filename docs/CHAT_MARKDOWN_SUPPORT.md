# Chat Markdown Destek Rehberi

## Belirti: Yanıt düz metin görünüyor

Önce tarayıcıda `/chat-markdown.js` ve `/chat-markdown.css` assetlerinin servis edildiğini kontrol et. Ardından `#messages` altında asistan mesajının `.content` düğümünü incele. Kullanıcı mesajlarında Markdown olmaması beklenen davranıştır.

## Belirti: Kod bloğu kopyalanmıyor

Kopyalama Clipboard API'ye bağlıdır. Site güvenli context dışında çalışıyorsa veya tarayıcı izin vermiyorsa clipboard başarısız olabilir. Bu durumda model yanıtının kendisi değişmez.

## Belirti: Geniş tablo sayfayı bozuyor

Tablonun `.md-table-wrap` içinde olması gerekir. Bu sınıf yatay kaydırmayı tabloya taşır. Global `overflow` kuralı ekleyerek sohbet container'ının taşmasını çözmeye çalışma; renderer'ın kendi sınırını koru.

## Belirti: Kötü URL tıklanabilir

Bu bir güvenlik regresyonudur. `safeLinkHref()` yalnız `http:`, `https:` ve `mailto:` kabul etmeli; source testindeki URL matrisi fail olmalıdır. Önceki davranışa dönmek yerine allowlist'i dar tut.

## Belirti: Streaming sonrası biçim bozuluyor

Observer kaynak metni `data-markdownSource` ile karşılaştırır. `app.js` aynı source'u yeniden yazdığında ikinci render beklenmez. Mutation observer kendi render'ını tekrar görürse `markdownWriting` guard'ı devreye girer.

## Belirti: Çok uzun model yanıtı tarayıcıyı zorluyor

Input, block, list, table, inline ve code sınırları ayrı uygulanır. Sınırların artırılması yerine ölçülen gerçek ihtiyaç belgelenmelidir. Özellikle inline limitini yükseltmek CPU regresyonu riskini artırır.

## Ürün kararları

Raw HTML, embedded image, iframe, arbitrary CSS, script ve remote include desteklenmez. Markdown yalnız presentation layer'dır; source conversation storage olduğu gibi kalır.
