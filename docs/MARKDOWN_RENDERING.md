# Markdown render sınırı

Bu belge, asistan yanıtlarının sohbet yüzeyinde nasıl render edildiğini ve bu katmanın neden bir güvenlik sınırı sayıldığını tanımlar.

## Sorun

Mesajlar `textContent` ile basılıyordu. Model markdown üretiyor, kullanıcı ise ham `**kalın**`, `##` ve biçimsiz kod blokları görüyordu. Kod blokları özellikle kötü durumdaydı: satır sonları korunuyordu ama tek aralıklı yazı tipi, dil etiketi, yatay kaydırma ve kopyalama yoktu.

Bu, kuralların 1. önceliği olan "Claude-benzeri sohbet arayüzü ve kaliteli mobil/masaüstü UX" başlığına doğrudan giriyor.

## Neden güvenlik sınırı

Asistan çıktısı güvenilir girdi değildir. İçeriğini şunlar şekillendirir:

- kullanıcının kendi istemi;
- tool sonuçları (Gmail mesaj gövdeleri, Canva tasarım başlıkları, GitHub dosya içerikleri);
- context içine giren geçmiş konuşma.

Yani bir e-postanın gövdesindeki `<img src=x onerror=...>` ya da `[tıkla](javascript:...)` asistan yanıtı üzerinden sohbet yüzeyine ulaşabilir. `textContent`'ten `innerHTML`'e geçmek bu yüzden düz bir kolaylık değişikliği değil, doğrudan bir XSS yüzeyi açardı.

## Tasarım

`public/markdown.js` iki aşamalıdır ve **hiçbir aşamada HTML metni üretmez**:

1. `parseMarkdown(source)` → düz veri blokları (`heading`, `paragraph`, `list`, `code`, `quote`, `rule`). DOM gerektirmediği için Node içinde doğrudan test edilir.
2. `renderMarkdown(document, target, source)` → blokları `createElement` / `createTextNode` ile düğümlere çevirir.

`innerHTML`, `insertAdjacentHTML`, `outerHTML` ve `document.write` bu modülde hiç kullanılmaz. Kaynak metindeki `<script>` bir metin düğümüdür; tarayıcı onu karakter olarak gösterir, ayrıştırmaz.

### Bağlantılar

Yalnızca `http:`, `https:` ve `mailto:` şemaları bağlantıya dönüşür. `javascript:`, `data:`, `vbscript:` ve tanınmayan şemalar düz metne düşer — etiket ve hedef görünür kalır ama tıklanabilir olmaz.

Üretilen her `<a>` etiketi `target="_blank"` ve `rel="noopener noreferrer nofollow"` taşır.

### Kod blokları

Kapanış fence'i olmayan blok da render edilir; streaming sırasında kapanış işareti henüz gelmemiş olabilir. Kopyala düğmesi `data-code` içinde **kaynak metni** taşır, render edilmiş metni değil.

Kopyalama dinleyicisi `#messages` üzerinde delege edilir, çünkü her streaming güncellemesi düğümleri yeniden oluşturur.

### Kullanıcı mesajları

Yalnızca `role === 'assistant'` içerikleri markdown olarak işlenir. Kullanıcının yazdığı metin `textContent` ile aynen gösterilir; kendi yıldız ve backtick karakterleri yeniden yorumlanmaz.

### Streaming

`renderMarkdown` her çağrıda `replaceChildren()` ile hedefi boşaltır. Bu, akış sırasında saniyede birkaç kez çağrılmaya uygundur ve içerik tekrarını imkânsız kılar.

## Servis çalışanı

`/markdown.js` kabuk varlıklarına eklendi ve `CURRENT_CACHE` `v15`'e yükseltildi. Sürüm yükseltilmeseydi mevcut kurulumlarda eski kabuk önbelleği modülsüz kalırdı.

## Doğrulama

| Betik | Kapsam |
| --- | --- |
| `test-markdown.mjs` | Blok ve satır içi ayrıştırma, fence davranışı, XSS ve şema reddi, minimal DOM ikizi ile render |
| `test-markdown-wiring.mjs` | Script sırası, app.js bağlantısı, delege kopyalama, kabuk önbelleği, CSS |

Ayrıca gerçek Chromium ile elle doğrulandı: `<script>alert("xss")</script>` metin olarak kaçırıldı, `javascript:` bağlantısı düz metin kaldı, güvenli bağlantı doğru `rel` değerleriyle anchor oldu.

## Yan düzeltme

`public/app.js` içinde `#micBtn` için "Sesli giriş sonraki küçük geliştirme turunda etkinleştirilecek." toast'ı duruyordu. Oysa `public/voice-input.js` aynı düğmeye gerçek konuşma tanımayı zaten kuruyor ve `ui-shell.js` bunu kenar çubuğundaki ses kartına yansıtıyor. İki dinleyici birlikte çalıştığı için kullanıcı sesli girişi başlatıyor ama aynı anda "henüz hazır değil" mesajı görüyordu. Placeholder kaldırıldı; `test-markdown-wiring.mjs` geri gelmesini engelliyor.

Dosya ekleme placeholder'ı dokunulmadan bırakıldı — o özellik gerçekten uygulanmamış durumda.

## Geri alma

`public/markdown.js`, `scripts/test-markdown.mjs`, `scripts/test-markdown-wiring.mjs` ve bu belge silinir; `public/index.html` içindeki script etiketi, `public/app.js` içindeki `renderMessageContent` ile kopyalama dinleyicisi, `public/styles.css` içindeki markdown ve kod bloğu stilleri geri alınır; `public/sw-policy.js` içinde `/markdown.js` çıkarılıp `CURRENT_CACHE` `v14`'e döndürülür.
