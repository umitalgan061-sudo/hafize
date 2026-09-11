# Kontrol kapısı

Hafize'nin tam doğrulama girişi `npm run check` ve `npm test` komutlarının çağırdığı `scripts/run-checks.mjs` koşucusudur.

Koşucu kök `*.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js` kaynaklarını `node --check` ile tarar. Ardından `scripts/validate-*.mjs` doğrulama paketleri ile `scripts/test-*.mjs` test paketlerini diskten otomatik keşfedip ayrı alt süreçlerde çalıştırır. Paket başına 120 saniye, syntax için 30 saniye sınırı vardır; en fazla dört paket paralel çalışır ve ilk hatada durulmaz.

Her child-process stdout/stderr akışı en fazla 64 KiB tutulur. Daha büyük çıktı `OUTPUT_TRUNCATED` ile işaretlenir; böylece hata raporlama yapılırken sınırsız bellek birikimi oluşmaz.

Yeni bir doğrulama veya test dosyası eklendiğinde `package.json` içine ayrıca yol eklemek gerekmez. `--list` keşfedilen paketleri, `--filter=a,b` ise eşleşen odak paketleri listeler/çalıştırır. Filtre geliştirici döngüsü içindir; PR öncesi filtresiz tam kapı kullanılır.

Runner hata çıktısını bounded biçimde raporlar ve keşif/çalıştırma hatasında fail-closed şekilde sıfır olmayan çıkış kodu verir. Secret veya credential değeri kendi çıktısına ekleyen testler repo sözleşmesine aykırıdır.

## Paylaşılan kontrol yardımcıları

`scripts/check-support.mjs` test paketi değildir; `test-`/`validate-` önekine sahip olmadığı için runner onu suite olarak çalıştırmaz, yalnız syntax taramasına girer. Kaynak-sözleşme kontrollerinin biçim ayrıntılarına bağlanmaması için üç yardımcı sunar:

- `compactCss()` ve `hasMediaQuery()`: stylesheet iddiaları boşluk biçimlendirmesinden bağımsız çalışır.
- `readShellCacheVersion()` / `readShellCacheName()`: yayınlanan service worker shell cache sürümünün tek kaynağı `public/sw-policy.js` dosyasıdır.
- `previousShellCacheNames()`: eski cache temizliği senaryoları için sürüm listesi üretir.

## Kapı hijyeni

İki doğrulama paketi kapının tekrar çürümesini engeller:

- `validate-check-gate-hygiene.mjs`: hiçbir suite yayınlanan shell cache sürümünü literal olarak sabitlemez. Bu sabitleme daha önce rutin bir cache bump'ında altı paketi kırmıştı. Eski sürümler stale-cache örneği olarak kullanılabilir; yalnız güncel sürüm sabitlenemez.
- `validate-builtin-skills.mjs`: `skills/builtin.json` manifest sözleşmesinden geçer, her skill'in aracı runtime tool kataloğunda gerçekten uygulanmıştır ve her skill en az bir ajan politikası tarafından çalıştırılabilir. Geçersiz bir katalog girdisi tek bir özelliği bozmakla kalmaz; `lib/tool-runtime.mjs` builtin runtime'ı import anında kurduğu için sunucu hiç başlamaz.

Stale literal yerine davranış iddia edilmesi tercih edilir: bir kaynak-sözleşme testi, modülün gerçekten kullandığı biçimi (örneğin `setAttribute` çağrısı veya enjekte edilebilir storage handle'ı) kontrol etmelidir.
