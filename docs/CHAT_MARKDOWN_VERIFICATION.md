# Chat Markdown Doğrulama Prosedürü

## 1. Kaynak doğrulaması

Renderer'ın yalnız `public/chat-markdown.js` üzerinden yüklenmesi, CSS'in ayrı stylesheet olması ve index'in her iki asset'i bir kez referans etmesi gerekir. Aynı asset birden fazla script etiketiyle yüklenmemelidir.

## 2. Parser doğrulaması

Normal cevapta paragraf, başlık ve liste bloklarını kontrol et. Birden çok boş satırın gereksiz boş DOM bloklarına dönüşmediğini doğrula. Ordered list başlangıcı test et.

## 3. Code doğrulaması

Backtick ve tilde fence test edilir. Dil etiketi normal ve kötü girdilerle sınanır. Fence kapanmazsa `closed=false` korunur. Kod içindeki HTML metni element değildir.

## 4. Table doğrulaması

İki sütunlu ve çok sütunlu tablo test edilir. Alignment `left`, `center`, `right` değerleri kontrol edilir. Header/separator sayısı uyuşmazsa tablo parser'ı devreye girmemelidir.

## 5. Link doğrulaması

`http`, `https`, `mailto` pozitif; `javascript`, `data`, `vbscript`, `file`, `ftp`, relative ve protocol-relative negatif olmalıdır. Tıklanabilir linkte `noopener noreferrer nofollow` bulunmalıdır.

## 6. DOM doğrulaması

Renderer'ın oluşturduğu node'lar `createElement` ve `textContent` ile yazılmalıdır. HTML string sink'leri bulunmamalıdır. Render sonucu `script`, `iframe`, `img` veya `object` üretmemelidir.

## 7. Streaming doğrulaması

Bir assistant message'a text mutation geldiğinde observer tek tarama planlar. Aynı kaynak ikinci kez geldiğinde ikinci render oluşmaz. Renderer kendi mutation'ı yüzünden sonsuz döngüye girmemelidir.

## 8. Clipboard doğrulaması

Code copy düğmesi ham `pre.textContent` alır. Clipboard API yoksa hata sessizce sınırlandırılır. Başarılı durumda buton geçici olarak `Kopyalandı` olur.

## 9. PWA doğrulaması

Shell cache revision yeni değeri taşır. JS/CSS shell listesine eklenir. API yollarının network-only sınıflandırması değişmez. Eski shell cache'lerinin silinmesi korunur.

## 10. Responsive doğrulama

700 px altı genişlikte code/table blockları sayfayı genişletmemelidir. Focus-visible, reduced-motion ve forced-colors stilleri görünür olmalıdır.

## 11. Regression

Message Workspace metadata'sı, Conversation Workspace ve app state birbirinden ayrı kalmalıdır. Markdown özelliği bunların storage key'lerini okuyamaz veya yazamaz.

## 12. Yayın sonrası

Önce özel Markdown testleri, sonra tam `npm run check`, ardından server smoke çalıştırılır. Tam check çalıştırılamıyorsa bu durum PR notunda saklanmaz.
