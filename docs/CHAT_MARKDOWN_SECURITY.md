# Chat Markdown Güvenlik Sınırı

## Tehdit modeli

Renderer'ın girdisi NVIDIA modelinden gelen metindir ve saldırgan tarafından dolaylı olarak etkilenebilir. Girdi HTML, JavaScript, URL, aşırı uzun metin ve biçimlendirme işaretleri içerebilir.

## DOM politikası

Renderer string HTML üretmez ve parse etmez. Her yapı DOM API'leriyle oluşturulur. Kullanıcı tarafından sağlanan metin `textContent` üzerinden düğümlere yazılır. Bu sınır `innerHTML`, `outerHTML`, `insertAdjacentHTML` ve `document.write` kullanımını yasaklar.

## URL politikası

Bir adres `URL` ile ayrıştırılır ve yalnız `http:`, `https:` veya `mailto:` şeması kabul edilir. `javascript:`, `data:`, `vbscript:` ve göreli yollar tıklanabilir bağlantıya dönüştürülmez. Dış bağlantılar `target=_blank` ve `rel=noopener noreferrer nofollow` ile üretilir.

## CSS sınıfları

Fence dil etiketi sınıf adının içine alınırken karakter kümesi sınırlandırılır. Geçersiz etiket boş kabul edilir. Böylece model çıktısı CSS selector enjeksiyonu oluşturamaz.

## Kaynak ayrımı

Sadece `.message.assistant .content` alanı Markdown olarak çizilir. `.message.user` metni model gibi davranılmaz ve biçimlendirme almaz. Bu ayrım hem UX hem de güvenlik için korunur.

## Veri ve kimlik bilgileri

Markdown modülü storage'a erişmez. Cookie, oturum token'ı, Authorization header'ı ve environment değeri okuyamaz. Yeni HTTP endpoint'i veya network çağrısı tanımlamaz. Kod kopyalama yalnız kullanıcının açık tıklamasıyla Clipboard API'ye gider.

## Kaynak sınırları

Büyük input 64 KiB ile kesilir; blok, liste, tablo ve kod satırı sayıları ayrı limitlere sahiptir. Satır içi parser 4 KiB'yi aşan satırı düz metin olarak bırakır. Bu, kötü biçimlendirme işaretlerinin yüksek CPU maliyetini sınırlar.

## PWA

Service worker `/chat-markdown.js` ve `/chat-markdown.css` dosyalarını shell cache'e alır. `/api/*` yolları shell cache'e giremez ve network-only kalır.

## Geri alma

Özellik kaldırılırken index asset referansları ve shell listesi girdileri çıkarılır; sohbet verisi veya backend şeması için migration gerekmez.
