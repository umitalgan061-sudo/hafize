# Sohbet markdown yüzeyi

Asistan yanıtları düz metin yerine `public/chat-markdown.js` üzerinden biçimlendirilir: `parseMarkdown()` metni dondurulmuş bir blok ağacına çevirir, `renderMarkdown()` bu ağacı DOM düğümlerine dönüştürür.

## Güvenlik sınırı

Model çıktısı güvenilmeyen metindir. Katman hiçbir yerde HTML metninden düğüm üretmez; yalnız `createElement` ve `textContent` kullanır, bu yüzden bir yanıt markup veya script enjekte edemez — `scripts/test-chat-markdown.mjs` dosyanın HTML-string ataması içermediğini de doğrular. Bağlantılar allowlist ile sınırlıdır: yalnız `http:`, `https:` ve `mailto:` tıklanabilir düğüm olur; `javascript:`, `data:` ve göreli hedefler düz metin kalır ve üretilen `<a>` düğümleri `rel="noopener noreferrer nofollow"` taşır. Kullanıcının yazdığı mesaj biçimlendirilmez; biçimlendirme yalnız `assistant` rolüne uygulanır.

## Kapsam ve sınırlar

Başlık (`#`–`###`, sayfanın kendi outline'ını bozmamak için `h3`'ten başlar), paragraf, sırasız/sıralı liste, alıntı, yatay çizgi, satır içi `kod`, `**kalın**`, `*eğik*`, `[bağlantı](https://…)` ve üç tırnaklı kod bloğu desteklenir. Girdi uzunluğu, blok sayısı, liste öğesi ve dil etiketi sabit üst sınırlarla bağlıdır; dil etiketi tanımlayıcı desenine uymuyorsa yok sayılır. Satır içi tarama eşleşmeyen uzun işaret dizilerinde karesel maliyetlidir ve akış sırasında her parçada yeniden çalışır, bu yüzden `maxInlineLength` üstündeki satırlar biçimlendirilmeden düz metin olarak çizilir.

## Akış, kopyalama ve geri alma

Kapanış tırnağı henüz gelmemiş kod bloğu akışın normal ara hâlidir: gelen kısım kod bloğu olarak çizilir, ham tırnaklar metne sızmaz. Her güncelleme mevcut ağacı değiştirir, üzerine eklemez; streaming sırasında blok tekrarı oluşmaz. Kod bloğu başlığında dil etiketi ve "Kopyala" düğmesi bulunur; düğme her çizimde yeniden üretildiği için tıklama işleyicisi `app.js` içinde mesaj listesine delege edilir ve metni `<pre>` içeriğinden okur. Modül `public/index.html` içinden kaldırılırsa `renderContent()` `globalThis.HafizeChatMarkdown` yokluğunda düz metin çizimine geri döner.
