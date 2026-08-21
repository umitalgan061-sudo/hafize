# Hafize kalite kapısı (`npm run check`)

## Neden değişti

Kapı daha önce `package.json` içinde elle bakımı yapılan tek satırlık uzun bir `&&` zinciriydi. Bu yaklaşımın iki somut arızası ölçüldü:

1. **Sessiz kapsam kaybı.** `scripts/` altındaki 85 test dosyasının 33'ü zincire hiç eklenmemişti; OAuth, token şifreleme, PKCE, kişisel bellek ve ekran paylaşımı testlerinin tamamı kapı dışındaydı.
2. **Zincirin erken kopması.** `&&` zinciri ilk hatada durduğu için `scripts/test-tool-runtime.mjs` içindeki eskimiş beklenti, kendisinden sonraki ~60 kontrolün hiç çalışmamasına yol açıyordu.

## Yeni davranış

`npm run check` (ve eşanlamlısı `npm test`) artık `scripts/run-checks.mjs` çalıştırır:

- `server.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js` dosyaları keşfedilerek `node --check` ile taranır.
- `scripts/validate-agent-registry.mjs` ve keşfedilen tüm `scripts/test-*.mjs` dosyaları sırayla çalıştırılır.
- Bir kontrolün başarısız olması diğerlerini durdurmaz; tüm sonuçlar toplanır, sonda başarısız dosyalar listelenir ve süreç `1` koduyla çıkar.
- Her test için 120 saniyelik zaman aşımı vardır; asılı kalan bir test kapıyı süresiz bloke edemez.
- `node scripts/run-checks.mjs <filtre>` yalnız adı filtreyi içeren kontrolleri çalıştırır (örn. `node scripts/run-checks.mjs gmail`).

Yeni bir `lib/` modülü veya `scripts/test-*.mjs` dosyası eklendiğinde `package.json` düzenlemesi gerekmez; dosya keşifle kapıya girer.

## Kapının kendi testi

`scripts/test-check-gate.mjs` keşif sözleşmesini kilitler: her `scripts/test-*.mjs` dosyasının çalıştırılacak listede, her `lib/`, `public/` ve kök kaynak dosyasının syntax listesinde bulunduğunu ve keşfin deterministik/tekrarsız olduğunu doğrular. Böylece bu turda düzeltilen kapsam kaybı tekrar oluşamaz.

## Geri alma

`package.json` içindeki `check` betiği eski `&&` zinciriyle değiştirilerek davranış geri alınabilir; `scripts/run-checks.mjs` ve `scripts/test-check-gate.mjs` bağımsız dosyalardır, silinmeleri başka modülleri etkilemez.
