# Kontrol kapısı

Hafize'nin tam doğrulama girişi `npm run check` ve `npm test` komutlarının çağırdığı `scripts/run-checks.mjs` koşucusudur.

Koşucu kök `*.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js` kaynaklarını `node --check` ile tarar. Ardından `scripts/validate-*.mjs` doğrulama paketleri ile `scripts/test-*.mjs` test paketlerini diskten otomatik keşfedip ayrı alt süreçlerde çalıştırır. Paket başına 120 saniye, syntax için 30 saniye sınırı vardır; en fazla dört paket paralel çalışır ve ilk hatada durulmaz.

Her child-process stdout/stderr akışı en fazla 64 KiB tutulur. Daha büyük çıktı `OUTPUT_TRUNCATED` ile işaretlenir; böylece hata raporlama yapılırken sınırsız bellek birikimi oluşmaz.

Yeni bir doğrulama veya test dosyası eklendiğinde `package.json` içine ayrıca yol eklemek gerekmez. `--list` keşfedilen paketleri, `--filter=a,b` ise eşleşen odak paketleri listeler/çalıştırır. Filtre geliştirici döngüsü içindir; PR öncesi filtresiz tam kapı kullanılır.

Runner hata çıktısını bounded biçimde raporlar ve keşif/çalıştırma hatasında fail-closed şekilde sıfır olmayan çıkış kodu verir. Secret veya credential değeri kendi çıktısına ekleyen testler repo sözleşmesine aykırıdır.

## Sürüklenme (drift) kuralları

Test paketleri sürümlenen sabitleri (`hafize-shell-v<N>` gibi) veya tam varlık listelerini birebir kopyalamaz; bunlar her özellik turunda değişir ve kapıyı özellik hatası olmadan kırar. Bunun yerine değişmezler doğrulanır: kalıp eşleşmesi, çekirdek varlıkların kapsanması, tekrarsızlık ve kaynağın kendi sabitine (`policy.CURRENT_CACHE`) göre karşılaştırma.

Aynı nedenle async fabrikalar `assert.rejects`, zamanlayıcı kullanan davranışlar ise gecikmeye göre seçilen sahte timer'larla test edilir; çağrı sırasına bağlı `timers.shift()` gibi kabuller runtime yeni bir timer eklediğinde yanlış negatif üretir.
