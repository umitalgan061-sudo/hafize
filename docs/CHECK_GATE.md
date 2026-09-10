# Kontrol kapısı

Hafize'nin tam doğrulama girişi `npm run check` ve `npm test` komutlarının çağırdığı `scripts/run-checks.mjs` koşucusudur.

Koşucu kök `*.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js` kaynaklarını `node --check` ile tarar. Ardından `scripts/validate-*.mjs` doğrulama paketleri ile `scripts/test-*.mjs` test paketlerini diskten otomatik keşfedip ayrı alt süreçlerde çalıştırır. Paket başına 120 saniye, syntax için 30 saniye sınırı vardır; en fazla dört paket paralel çalışır ve ilk hatada durulmaz.

Her child-process stdout/stderr akışı en fazla 64 KiB tutulur. Daha büyük çıktı `OUTPUT_TRUNCATED` ile işaretlenir; böylece hata raporlama yapılırken sınırsız bellek birikimi oluşmaz.

Yeni bir doğrulama veya test dosyası eklendiğinde `package.json` içine ayrıca yol eklemek gerekmez. `--list` keşfedilen paketleri, `--filter=a,b` ise eşleşen odak paketleri listeler/çalıştırır. Filtre geliştirici döngüsü içindir; PR öncesi filtresiz tam kapı kullanılır.

Runner hata çıktısını bounded biçimde raporlar ve keşif/çalıştırma hatasında fail-closed şekilde sıfır olmayan çıkış kodu verir. Secret veya credential değeri kendi çıktısına ekleyen testler repo sözleşmesine aykırıdır.

## Kırılgan iddia yasağı

Kapı sinyalinin değerini koruyan iki kural:

- Bir testte sürüm numarası, asset listesi veya kaynak kodu metni sabit olarak yazılmaz. PWA shell cache sürümü her yeni özellikte artar; testler sürümü `CACHE_PREFIX` ile birlikte biçim olarak doğrular, `SHELL_ASSETS` için ise değişmez kuralları (tekil same-origin yol, `public/` içinde gerçekten var olma, çekirdek shell'in bulunması) kontrol eder.
- Bir güvenlik veya onay sınırı ile test beklentisi çeliştiğinde sıkı olan taraf korunur; test fixture'ı güncellenir, sınır gevşetilmez.

## Kapı durumu

Kapı yeşil tutulur. Kırmızı bir kapı ile yeni özellik turu açılmaz; önce başarısız paketler giderilir.
