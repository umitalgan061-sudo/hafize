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
Böylece bir refactor veya cache sürümü artışı ilgisiz paketleri kırmaz.

Runner hata çıktısını bounded biçimde raporlar ve keşif/çalıştırma hatasında fail-closed şekilde sıfır olmayan çıkış kodu verir. Secret veya credential değeri kendi çıktısına ekleyen testler repo sözleşmesine aykırıdır.
