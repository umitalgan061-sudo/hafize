# Sohbet Markdown Render

Hafize'nin asistan yanıtları artık düz metin yerine biçimlendirilmiş olarak
gösterilir. Model çıktısındaki başlıklar, listeler, tablolar, alıntılar ve kod
blokları okunabilir bloklara dönüştürülür; kullanıcı mesajları ise olduğu gibi
düz metin kalır.

## Neden

Önceki davranışta `public/app.js`, asistan yanıtını `content.textContent`
ile yazıyordu. NVIDIA NIM modelleri markdown üretir; bu yüzden ekranda
`**kalın**`, `- madde` ve üç ters tırnaklı kod çitleri ham karakter olarak
görünüyordu. Kod bloğunu kopyalamak, uzun bir tabloyu okumak veya adım listesini
takip etmek mümkün değildi.

## Mimari

Üç dosya vardır ve her biri tek bir işe bakar:

| Dosya | Sorumluluk |
| --- | --- |
| `public/markdown-renderer.js` | Saf ayrıştırıcı ve DOM üretici. Tarayıcı API'si dışında bağımlılığı yoktur, Node içinden `require` edilerek test edilir. |
| `public/chat-markdown.js` | Sohbet katmanı: streaming sırasında boyama birleştirme, kod bloğu kopyalama, düz metin projeksiyonu. |
| `public/chat-markdown.css` | Yalnızca `.message.assistant .content[data-md]` altındaki blokları biçimlendirir. |

`public/app.js` içindeki tek giriş noktası `paintContent()`'tir. Katman
yüklenmemişse `textContent` fallback'i devrededir; yani render katmanı olmadan da
sohbet çalışmaya devam eder.

## Desteklenen sözdizimi

- ATX başlıkları (`#` … `######`), kapanış diyezleri temizlenir.
- Paragraflar. Paragraf içindeki tek satır sonu görünür satır başı olur; sohbet
  yanıtlarında model bilerek satır kırdığı için CommonMark'ın "boşluk" davranışı
  yerine bu tercih edilmiştir.
- ``` ve `~~~` çitli kod blokları, isteğe bağlı dil etiketiyle.
- `>` alıntıları, iç içe ve tembel devam satırlarıyla.
- Sırasız (`-`, `*`, `+`) ve sıralı (`1.`, `1)`) listeler; iç içe listeler, madde
  içinde paragraf/kod blokları, tight/loose ayrımı.
- GFM boru tabloları, `:--`/`--:`/`:-:` hizalamalarıyla.
- Yatay çizgiler (`---`, `***`, `___`).
- Satır içi: `**kalın**`, `*eğik*`, `~~üstü çizili~~`, `` `kod` ``, `[etiket](url)`,
  `<https://…>` autolink'leri, çıplak `https://…` adresleri ve `\` kaçışları.

## Bilerek desteklenmeyenler

- **Ham HTML.** Model çıktısındaki `<script>`, `<img>` veya herhangi bir etiket
  ayrıştırılmaz; harfi harfine metin olarak görünür. Ayrıntı için
  `docs/CHAT_MARKDOWN_SECURITY.md`.
- **Resim yerleştirme.** `![alt](url)` bir bağlantı olarak çizilir. Yanıt, kendi
  başına uzak bir adrese istek attıramaz.
- **Girintili (4 boşluk) kod blokları.** Girinti, liste içeriği için kullanılır;
  çitli bloklar model çıktısında zaten standarttır.
- **Referans tanımlı bağlantılar (`[a]: https://…`).** Sohbet yanıtlarında pratikte
  görülmüyor.
- **Sözdizimi renklendirme.** Kod blokları tek renk gösterilir; bu, yeni bir
  bağımlılık eklemeden okunabilirliği korur.

## Streaming

SSE delta'ları saniyede yüzlerce kez gelir. `chat-markdown.js` her delta'da
yeniden ayrıştırmak yerine boyamaları tek bir `requestAnimationFrame` içinde
birleştirir ve yalnızca en yeni metin çizilir. Akış biterken gelen son boyama
`persist: true` ile senkron çalışır ve bekleyen frame iptal edilir; böylece eski
bir delta nihai yanıtın üzerine yazamaz.

Yarım kalan bir kod çiti kapanmamış kabul edilir ve blok `data-streaming="true"`
ile işaretlenir; başlık çubuğunda "yazılıyor" ibaresi görünür. Yarım bir tablo,
ayraç satırı gelene kadar düz metin olarak durur.

Mesaj listesi `aria-live="polite"` bir log olduğundan, akış süresince `.content`
düğümü `aria-busy="true"` taşır. Ekran okuyucu büyüyen yanıtı defalarca okumak
yerine yalnızca tamamlanmış hâli duyurur.

## Sınırlar

`HafizeMarkdown.LIMITS` dondurulmuş bir nesnedir:

| Sınır | Değer | Anlamı |
| --- | --- | --- |
| `MAX_SOURCE_LENGTH` | 120 000 | Daha uzun yanıtın kuyruğu düz metin kalır. |
| `MAX_LINES` | 4 000 | Satır sayısı üst sınırı. |
| `MAX_BLOCKS` | 800 | Üretilen blok sayısı üst sınırı. |
| `MAX_BLOCK_DEPTH` | 6 | Alıntı/liste iç içe geçme derinliği. |
| `MAX_INLINE_DEPTH` | 8 | Satır içi vurgu derinliği. |
| `MAX_INLINE_NODES` | 600 | Tek bir satır içi çalıştırmadaki düğüm sayısı. |
| `MAX_LIST_ITEMS` | 300 | Tek listedeki madde sayısı. |
| `MAX_TABLE_ROWS` / `MAX_TABLE_COLUMNS` | 120 / 16 | Tablo boyutu. |
| `MAX_URL_LENGTH` | 2 048 | `href`'e yazılabilecek en uzun adres. |

Bir sınıra takılan yanıt sessizce kısaltılmaz: kapsayıcı `data-md="truncated"`
alır ve CSS, kalan bölümün düz metin gösterildiğini bildiren bir not basar.

## Aşağı akış tüketicileri

Render edilen bir yanıtta `textContent` artık ham markdown değildir ve blok
elemanları ayraçsız birleşir. Bu yüzden:

- `public/chat-composer-features.js` "Kopyala" düğmesi `sourceFor()` ile modelin
  yazdığı markdown'ı kopyalar.
- `public/message-workspace.js` kayıt metnini `plainTextFor()` ile okur; satır
  sonları korunur.
- `public/voice-output.js` yine markdown kaynağını okur, çünkü kendi
  `normalizeSpeechText()` fonksiyonu kod bloklarını ve bağlantıları zaten ayıklar.

Kod bloğu başlık çubuğundaki dil etiketi ve kopyalama düğmesi metin düğümü
içermez; etiketleri CSS `content` ile çizilir. Böylece `textContent` tam olarak
yanıtın kendisi kalır.

## Test

```bash
node scripts/test-chat-markdown-blocks.mjs
node scripts/test-chat-markdown-inline.mjs
node scripts/test-chat-markdown-security.mjs
node scripts/test-chat-markdown-dom.mjs
node scripts/test-chat-markdown-streaming.mjs
node scripts/test-chat-markdown-limits.mjs
node scripts/test-chat-markdown-integration.mjs
```

DOM testleri `scripts/markdown-dom-harness.mjs` içindeki küçük DOM taklidini
kullanır; böylece kaynak dosyada desen aramak yerine gerçek düğüm ağacı
doğrulanır.

## Geri alma

Render katmanı eklemelidir, değiştirici değildir. Geri almak için
`public/index.html` içindeki üç varlık satırı ve `public/app.js` içindeki
`paintContent()` çağrıları kaldırılır, `public/sw-policy.js` cache sürümü
artırılır. Aşağı akış tüketicileri fallback'lerini koruduğu için bu üç dosya
olmadan da çalışır.
