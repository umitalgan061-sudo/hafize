# Markdown Güvenlik Vaka Kataloğu

Renderer aşağıdaki aileleri güvenli metin olarak ele almalıdır.

## HTML ve event injection

`<script>`, `<img onerror>`, `<svg onload>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<button>` ve `style` benzeri HTML parçaları element üretmemelidir. Modelin bir cevapta bunları yazması renderer tarafından browser davranışına çevrilmemelidir.

## URL injection

`javascript:`, `data:`, `vbscript:`, `file:`, `ftp:`, protocol-relative ve relative adresler tıklanabilir olmamalıdır. Case variation ve whitespace variation da allowlist kararını aşmamalıdır.

## CSS sınıf injection

Fence language alanı doğrudan class adına eklenmemelidir. Yalnız küçük harf/rakam ve sınırlı punctuation kabul edilmelidir. Geçersiz language boş label ile devam edebilir.

## Resource exhaustion

64 KiB input, 350 block, 240 list item, 120 table row, 16 table column, 4 KiB inline line ve 2000 code line sınırları bütün parser yollarında korunmalıdır. Bir alt yapı sınırı diğerini devre dışı bırakmamalıdır.

## Mutation loop

Observer kendi render'ını görür. Kaynak eşleşme guard'ı ve render sırasında `markdownWriting` flag'i olmadan parser kendi kendini tetikleyebilir. Her iki guard birden yaşam döngüsünü bounded tutar.

## Clipboard

Kopyalama yalnız `button` etkileşimi ile tetiklenir. Kod dışında metin okunmaz, network'e gönderilmez ve clipboard başarısızlığı model cevabını değiştirmez.

## Güvenlik kararının özeti

Renderer bir sanitizer değildir; daha güvenli bir parser mimarisidir. Tanınmayan yapılar güvenilir HTML olarak değil text olarak kalır. Bu nedenle yeni syntax eklenirken "hangi DOM yetkisini açıyor?" sorusu ilk kontroldür.
