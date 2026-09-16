# Kontrol kapısı

Hafize'nin tam doğrulama girişi `npm run check` ve `npm test` komutlarının çağırdığı `scripts/run-checks.mjs` koşucusudur.

Koşucu kök `*.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js` kaynaklarını `node --check` ile tarar. Ardından `scripts/validate-*.mjs` doğrulama paketleri ile `scripts/test-*.mjs` test paketlerini diskten otomatik keşfedip ayrı alt süreçlerde çalıştırır. Paket başına 120 saniye, syntax için 30 saniye sınırı vardır; en fazla dört paket paralel çalışır ve ilk hatada durulmaz.

Her child-process stdout/stderr akışı en fazla 64 KiB tutulur. Daha büyük çıktı `OUTPUT_TRUNCATED` ile işaretlenir; böylece hata raporlama yapılırken sınırsız bellek birikimi oluşmaz.

Yeni bir doğrulama veya test dosyası eklendiğinde `package.json` içine ayrıca yol eklemek gerekmez. `--list` keşfedilen paketleri, `--filter=a,b` ise eşleşen odak paketleri listeler/çalıştırır. Filtre geliştirici döngüsü içindir; PR öncesi filtresiz tam kapı kullanılır.

`scripts/` altındaki `test-`/`validate-` ile başlamayan dosyalar paket olarak çalıştırılmaz;
paylaşılan yardımcılardır. `shell-cache-contract.mjs` service worker shell cache
değişmezlerini (sürüm biçimi, eski sürümlerin temizlenmesi, her asset'in diskte bulunması,
`index.html`'in yüklediği her asset'in cache listesinde olması), `source-contract.mjs` ise
kaynak-sözleşme yardımcılarını sağlar: bir attribute markup ya da `setAttribute` ile,
bir sınıf seçici ya da sınıf adı olarak, CSS parçaları ise boşluktan bağımsız eşleşir.
`browser-module-harness.mjs` ise `public/*.js` tarayıcı modüllerini Node altında
yükler. Böylece bir refactor veya cache sürümü artışı ilgisiz paketleri kırmaz.

## Test yazarken kaçınılacak üç kalıp

Kapının 51 paketle kırmızı kaldığı dönemde tekrarlayan üç hata vardı. Yeni paket
yazarken bunlardan kaçının.

**1. Sabit cache sürümü.** `CURRENT_CACHE = ${CACHE_PREFIX}v29` gibi bir literal
kabuk her değiştiğinde kırılır ve farklı paketler farklı sürümlere sabitlendiğinde
aynı anda geçmeleri imkânsız hale gelir. Bunun yerine
`assertVersionedCacheDeclaration(sw)` veya `assertShellAssets([...])` kullanın.

**2. Ürünü değil kendi kopyasını test etmek.** Bir paket, doğrulayacağı mantığı
test dosyasının içinde yeniden yazıp o kopyaya assert ederse `public/` altında ne
olduğundan bağımsız olarak geçer veya kalır. Gerçek dosyayı
`browser-module-harness.mjs` ile yükleyin:

```js
import { createStorage, loadBrowserApi } from './browser-module-harness.mjs';
const localStorage = createStorage();
const { api } = loadBrowserApi('composer-history.js', 'HafizeComposerHistory', { localStorage });
```

Modül `globalThis`/`self` sahte bir köke bağlanarak mevcut realm'de çalıştırılır;
`document` verilmediği için kendini mount etmez ve yalnız saf API'sini yayınlar.
`createStorage(initial, { failOn: ['getItem'] })` engellenmiş site verisini taklit
eder. Değerler aynı realm'de üretildiği için `assert.deepStrictEqual` çalışır.

**3. Davranış yerine yazım biçimini sabitlemek.** `navigator.clipboard`,
`slice(0, MAX_VALUE)` veya `closest('.x')` gibi literal `grep`'ler, kod isteğe
bağlı zincirlemeye (`navigator?.clipboard`), bir `clamp()` yardımcısına veya
`closest?.()` biçimine geçtiğinde davranış hiç değişmeden kırılır. Sözleşmeyi
doğrulayın: mümkünse davranışı çalıştırın, değilse `source-contract.mjs`
yardımcılarını veya yazım biçimine toleranslı bir desen kullanın.

Runner hata çıktısını bounded biçimde raporlar ve keşif/çalıştırma hatasında fail-closed şekilde sıfır olmayan çıkış kodu verir. Secret veya credential değeri kendi çıktısına ekleyen testler repo sözleşmesine aykırıdır.
