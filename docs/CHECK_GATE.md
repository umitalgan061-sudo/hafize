# Kontrol kapısı

Hafize'nin tam doğrulama girişi `npm run check` ve `npm test` komutlarının çağırdığı `scripts/run-checks.mjs` koşucusudur.

Koşucu kök `*.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js` kaynaklarını `node --check` ile tarar. Ardından `scripts/validate-*.mjs` doğrulama paketleri ile `scripts/test-*.mjs` test paketlerini diskten otomatik keşfedip ayrı alt süreçlerde çalıştırır. Paket başına 120 saniye, syntax için 30 saniye sınırı vardır; en fazla dört paket paralel çalışır ve ilk hatada durulmaz.

Her child-process stdout/stderr akışı en fazla 64 KiB tutulur. Daha büyük çıktı `OUTPUT_TRUNCATED` ile işaretlenir; böylece hata raporlama yapılırken sınırsız bellek birikimi oluşmaz.

Yeni bir doğrulama veya test dosyası eklendiğinde `package.json` içine ayrıca yol eklemek gerekmez. `--list` keşfedilen paketleri, `--filter=a,b` ise eşleşen odak paketleri listeler/çalıştırır. Filtre geliştirici döngüsü içindir; PR öncesi filtresiz tam kapı kullanılır.

`scripts/` altındaki `test-`/`validate-` ile başlamayan dosyalar paket olarak çalıştırılmaz;
paylaşılan yardımcılardır. `shell-cache-contract.mjs` service worker shell cache
değişmezlerini (sürüm biçimi, eski sürümlerin temizlenmesi, her asset'in diskte bulunması,
`index.html`'in yüklediği her asset'in cache listesinde olması ve cache listesindeki her
`.js`/`.css` asset'inin hâlâ `index.html` tarafından yüklenmesi), `source-contract.mjs` ise
kaynak-sözleşme yardımcılarını sağlar: bir attribute markup ya da `setAttribute` ile,
bir sınıf seçici ya da sınıf adı olarak, CSS parçaları ise boşluktan bağımsız eşleşir.
`browser-storage-stub.mjs` ise tarayıcı modüllerini Node içinde çalıştırmak için bellek içi
`localStorage` ve bilinçli olarak hata fırlatan store taklitleri verir.
`dom-harness.mjs` panel paketleri için küçük bir DOM sağlar: element üretimi, attribute,
`dataset`, `hidden`/`disabled`, sınırlı bir seçici motoru, odak ve capture/bubbling ile
`stopImmediatePropagation()` destekleyen olay gönderimi. Böylece bir paket gerçek modülü
mount edip gerçek düğmelere tıklayabilir. Harness tarayıcı değildir; eksik bir yetenek
kazara taklit edilmez, bilinçli olarak eklenir ve `test-dom-harness.mjs` bu davranışları
sabitler.
Böylece bir refactor veya cache sürümü artışı ilgisiz paketleri kırmaz.

## TypeScript'e taşınmış tarayıcı modülleri

Smart Fill, komut paleti, Smart Fill ipuçları ve zamanlanmış görev sayacı TypeScript
kaynaklarından (`public/*.ts`) derlenir ve tarayıcıya `public/typed-build/*.js` olarak
gider. Bu nedenle:

- Kaynak sözleşmeleri `public/<modül>.ts` dosyasını okur; derlenmiş çıktı okunmaz.
- Çalışma zamanı sözleşmeleri modülü doğrudan `await import('../public/<modül>.ts')`
  ile yükler; Node tip sıyırma ile `.ts` dosyasını çalıştırır, ek derleme adımı gerekmez.
- `index.html` ve `SHELL_ASSETS` bu modülleri `/typed-build/<modül>.js` yolundan yükler.
- `public/typed-build/` git'e girmez. Shell sözleşmesi bu üretilmiş asset'leri diskte
  aramak yerine `vite.config.ts` içindeki entry ve onun TypeScript kaynağı üzerinden
  doğrular; böylece temiz bir checkout'ta `npm run build` çalıştırmadan da kapı yeşildir.
- `function x(...)` yerine `const x = (...): void =>` yazımı sözleşmeyi kırmamalıdır:
  `source-contract.mjs` içindeki `declaresFunction` / `assertDeclaresFunction` her iki
  yazımı da kabul eder, davranış kaybolduğunda ise yine başarısız olur.

## Biçim kontrolü

`npm run format:check` sondaki boşluk, dosya sonu satırı ve satır uzunluğunu denetler.
Uygulama kaynaklarında sınır 240 karakterdir. `scripts/` altındaki `.mjs` paketleri
bilinçli olarak satır başına tek yoğun assertion biçiminde yazıldığı için onlarda sınır
400 karakterdir; bu sınır yine de incelenemeyecek uzunluktaki satırı yakalar.

## Paket yazarken

- **Shell cache sürümü sabit yazılmaz.** `assertVersionedCacheDeclaration(sw)` ya da
  `assertShellCacheContract()` kullanılır. `v29` gibi bir sabit, bir sonraki asset
  değişikliğinde ilgisiz paketleri kırar.
- **Asset listesi tek yerden doğrulanır.** Yeni bir dosya `index.html` ve `SHELL_ASSETS`
  listesinin ikisine birden eklenir; `assertShellAssets([...])` özellik bazlı kontrol içindir.
- **Davranış tercih edilir, yazım değil.** Bir sınır veya kural test edilecekse modül
  `createRequire` ile yüklenip gerçekten çağrılır (`browser-storage-stub.mjs` bunun içindir).
  `slice(0, MAX_VALUE)` gibi bir regex, ortak bir `clamp()` yardımcısına geçildiğinde
  davranış korunsa bile kırılır.
- **Paket kendi taklidini test etmez.** Yalnızca dosya içinde tanımlanmış bir nesneye bakan
  paket hiçbir zaman üründe bir hata yakalayamaz; böyle bir paket yazılmaz. `test-dom-harness.mjs`
  bunun istisnası değil tamamlayıcısıdır: paylaşılan harness yanlış davranırsa onu kullanan
  paketler sessizce yanlış sonuç verir, bu yüzden harness'ın olay sırası ve seçici davranışı
  ayrıca sabitlenir.
- **Panel davranışı mount edilerek test edilir.** `dom-harness.mjs` ile gerçek modül gerçek
  bir kart üzerine mount edilir; `İçe aktarma önizlemesi`, `Kütüphane sağlığı` ve Smart Fill
  paketleri (`*-ui.mjs`) bunun örnekleridir. Kaynak metni yerine kullanıcı davranışı
  sabitlendiği için modülün TypeScript'e taşınması ya da yeniden yazılması sözleşmeyi kırmaz.
- Kaynak metnine bakan bir regex hâlâ meşrudur (ağ çağrısı yokluğu, `innerHTML` yasağı gibi
  yasaklar için), ancak varlık kontrolü yerine davranış kontrolü mümkünse o tercih edilir.

Runner hata çıktısını bounded biçimde raporlar ve keşif/çalıştırma hatasında fail-closed şekilde sıfır olmayan çıkış kodu verir. Secret veya credential değeri kendi çıktısına ekleyen testler repo sözleşmesine aykırıdır.
