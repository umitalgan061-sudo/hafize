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
`typed-browser-import.mjs`, `public/typed/*.ts` girişlerini Node içinde içe aktarmak içindir:
bu modüller içe aktarılırken kendilerini `install(document, …)` ile bağlar, bu yüzden yardımcı
her mount'un ilk kontrolünde (`documentElement`, `querySelector`) geri dönmesini sağlayan inert
bir `document` kurar ve import bittiğinde önceki globalleri geri koyar.
Böylece bir refactor veya cache sürümü artışı ilgisiz paketleri kırmaz.

## Paket yazarken

- **Kaynak yolu tipli dosyayı göstermelidir.** Bir tarayıcı modülü
  `public/typed/*.ts` altına taşındıysa paket artık `public/<ad>.js` dosyasını okumamalıdır;
  orada yalnızca derlenmiş girişe yönlendiren uyumluluk köprüsü kalır.
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
  paket hiçbir zaman üründe bir hata yakalayamaz; böyle bir paket yazılmaz.
- Kaynak metnine bakan bir regex hâlâ meşrudur (ağ çağrısı yokluğu, `innerHTML` yasağı gibi
  yasaklar için), ancak varlık kontrolü yerine davranış kontrolü mümkünse o tercih edilir.

Runner hata çıktısını bounded biçimde raporlar ve keşif/çalıştırma hatasında fail-closed şekilde sıfır olmayan çıkış kodu verir. Secret veya credential değeri kendi çıktısına ekleyen testler repo sözleşmesine aykırıdır.
