# Sohbet Markdown Render — Test Matrisi

Yedi paket `npm run check` içinde otomatik çalışır. Hiçbiri tarayıcı ya da ek
bağımlılık gerektirmez; DOM'a dokunanlar `scripts/markdown-dom-harness.mjs`
içindeki küçük `document` taklidini kullanır (bu dosya `test-`/`validate-`
önekiyle başlamadığı için koşucu tarafından paket olarak çalıştırılmaz).

| Paket | Kapsam | Örnek doğrulama |
| --- | --- | --- |
| `test-chat-markdown-blocks.mjs` | Blok ayrıştırma | Yedi diyez başlık değildir; ayraç satırı olmayan bir tablo paragraftır; boş satır listeyi loose yapar |
| `test-chat-markdown-inline.mjs` | Satır içi tarayıcı | `snake_case` bölünmez; kapanmayan kod açıklığı harfi harfine kalır; kod açıklığı vurgu eşleşmesinde atlanır |
| `test-chat-markdown-security.mjs` | Güvenilmeyen çıktı | 19 tehlikeli şema reddedilir; düşman girdide `script`/`iframe`/`img` düğümü üretilmez; `on*` niteliği hiç yazılmaz |
| `test-chat-markdown-dom.mjs` | Düğüm ağacı | Başlık seviyeleri, kod bloğu başlık çubuğu, tablo `scope`/`data-align`, yeniden render'ın eskiyi silmesi |
| `test-chat-markdown-streaming.mjs` | Akış davranışı | Yanıtın her ön eki çizilebilir; dört delta tek frame; nihai boyama bekleyen frame'i iptal eder; `aria-busy` yaşam döngüsü |
| `test-chat-markdown-limits.mjs` | Sınırlar ve kötü girdi | 3 000 karakterlik ayraç çorbası 1.5 sn bütçe içinde biter; 60 kat iç içe alıntı derinlik sınırında durur; en derin metin kaybolmaz |
| `test-chat-markdown-integration.mjs` | Bağlantı noktaları | Script sırası, offline shell listesi, `app.js` boyama çağrıları, aşağı akış tüketicileri, CSS kapsamı |

## Kapsanan sınır durumları

**Ayrıştırma**

- Boş, yalnızca boşluk, `null`, `undefined`, sayı, nesne ve fonksiyon girdi.
- Kod bloğu içinde markdown; iç içe çitler (dört ters tırnak üçü sarar).
- Girintili çit açılışının gövdeden temizlenmesi.
- Tembel alıntı devamı ve alıntı içinde liste.
- Madde içinde kod bloğu, madde içinde iç içe liste, girintili devam satırı.
- Kaçırılmış boru karakteri içeren tablo hücresi; eksik hücreli satırın
  doldurulması; dış boruların isteğe bağlı olması.
- Sıralı listenin başlangıç numarasını koruması; farklı madde işaretinin yeni
  liste başlatması.

**Akış**

- Yanıtın 0'dan tam uzunluğa kadar her ön eki (karakter karakter).
- Kapanmamış kod çiti ve yarım tablo.
- Frame kuyruğunda bekleyen eski delta ile nihai yanıtın yarışı.
- Render katmanı hiç yüklenmediğinde düz metin fallback'i.

**Güvenlik**

- 19 reddedilen şema/adres, 4 kabul edilen adres.
- 18 düşman yanıt gövdesi (ham etiketler, kapanış etiketi kaçışı, tablo ve
  başlık içinde script).
- Bağlantı izolasyonu (`target`, `rel`) ve resim referansının bağlantıya
  dönüşmesi.
- Kod bloğu kopyalama düğmesinin `textContent`'i kirletmemesi.

**Sınırlar**

- Uzunluk, satır, blok, madde, tablo satırı/sütunu ve URL uzunluğu üst sınırları.
- 15 farklı ayraç çorbası deseni, her biri zaman bütçesiyle.
- NUL, `\r\n`, sekme normalizasyonu; sağdan sola metin; emoji.

## Manuel kontrol listesi

Otomatik paketler DOM ağacını doğrular ama görünümü doğrulamaz. Bir yayın
öncesi elle bakılacaklar:

1. Açık ve koyu temada uzun bir kod bloğunun yatay kaydırması.
2. 360 px genişlikte bir tablonun kaydırılabilirliği ve klavyeyle odaklanması.
3. Kod bloğu kopyalama düğmesinin "Kopyalandı" geri bildirimi.
4. Akış sırasında kod bloğu başlığındaki "yazılıyor" ibaresinin kaybolması.
5. Ekran okuyucuyla tamamlanmış bir yanıtın bir kez okunması.
