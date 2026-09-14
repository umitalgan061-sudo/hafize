# Markdown Bakım Sözleşmesi

## Dosya sahipliği

`public/chat-markdown.js` yalnız asistan çıktı sunumundan sorumludur. Sohbet verisini kaydetmez, model çağrısı yapmaz, agent/tool seçmez ve network isteği açmaz. `public/chat-markdown.css` yalnız renderer'ın ürettiği `.md-*` sınıflarını biçimlendirir.

`public/app.js` sohbet durumunun sahibidir. Streaming veya edit davranışını Markdown dosyasına taşımak yapılmamalıdır. Buna karşılık renderer'da kullanıcı mesajını biçimlendirmek de yapılmamalıdır.

## Güvenlik değişmezleri

1. HTML string sink yoktur.
2. Link hedefi allowlist dışına çıkmaz.
3. Fence dili sınıf için güvenli desenle normalize edilir.
4. Input ve alt yapı limitleri korunur.
5. `/api/`, fetch, XHR, WebSocket, cookie veya Authorization erişimi yoktur.
6. Dış bağlantı `noopener noreferrer nofollow` taşır.

## API yüzeyi

Module global olarak `HafizeChatMarkdown` açar ve CommonJS test bağlamında aynı API'yi export eder. `parseMarkdown` ve `scanInline` saf dönüştürücülerdir. `renderMarkdown` DOM'a yazar. `copyCode` yalnız kullanıcının code-copy etkileşiminde Clipboard API kullanır. `install` observer yaşam döngüsünü başlatır ve `disconnect` ile kapatabilir.

Yeni public fonksiyon eklerken önce mevcut export'un aynı davranışı daha küçük bir yardımcıyla kapsamadığını kontrol et. Aynı soruna ikinci parser veya ikinci link sanitizer yazma.

## Test bakım ilkesi

Her parser kuralı için normal örnek, yanlış kullanım ve sınır örneği tutulur. Source tests implementation ayrıntılarına gereğinden fazla bağlanmamalıdır; güvenlik sink'leri ve veri sınırları ancak davranışın güvenlik garantisi olduğu ölçüde sabitlenir.

Tam kapı testinde tarihsel cache revision sayısını sabitlemekten kaçın. Shell sürümünün sayısal formatı ve asset inclusion sözleşmesi asıl invariant'tır.

## Değişiklik prosedürü

Parser değiştirildiğinde önce `chat-markdown` özel testleri, sonra full check çalıştırılır. CSS değiştiğinde mobil/reduced-motion/forced-colors contract kontrol edilir. Index değiştiğinde service worker shell listesi de karşılaştırılır.

## Bilinçli kapsam dışı

Raw HTML, resim embed, iframe, SVG injection, arbitrary style attribute, script URL, remote include, server-side rendering ve third-party syntax highlighting bu modülün parçası değildir.
