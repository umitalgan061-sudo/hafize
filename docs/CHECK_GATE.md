# Check gate

Hafize'nin tek kalite kapısı `npm run check`'tir. Depoda CI workflow'u yoktur;
bu yüzden gate'in eksiksiz ve güvenilir olması doğrudan ürün güvenliğini etkiler.

## Çalıştırma

```bash
npm run check                 # tüm syntax kontrolleri + tüm testler
npm run precheck              # hızlı UI alt kümesi (voice, ui-shell, sidebar)
node scripts/run-checks.mjs --list
node scripts/run-checks.mjs --filter gmail
node scripts/run-checks.mjs --syntax-only
node scripts/run-checks.mjs --tests-only
```

`HAFIZE_CHECK_TIMEOUT_MS` (1_000–600_000, varsayılan 120_000) test başına
zaman aşımını ayarlar. Süreyi aşan test SIGKILL ile durdurulur ve hata sayılır.

## Kapsam nasıl belirlenir

`scripts/run-checks.mjs` kapsamı diskten keşfeder; elle tutulan hiçbir liste yoktur.

- Syntax: `server.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js`
- Test: `scripts/test-*.mjs` ve `scripts/validate-*.mjs`

Yeni bir test dosyası eklemek onu gate'e dahil etmek için yeterlidir;
`package.json` düzenlenmez.

## Neden değişti

Önceki gate, `package.json` içinde elle yazılmış tek bir `&&` zinciriydi:

- Zincir ilk hatada durduğu için kırık bir iddia kendisinden sonraki tüm
  testleri sessizce gizliyordu.
- Zincir elle tutulduğu için diskteki 85 testin 32'si (Canva/Google OAuth,
  token store, PKCE, personal memory adapter'ları, screen-share, hands-free,
  device bridge, local model provider) hiç çalışmıyordu.

Runner ilk hatada durmaz; tüm başarısızlıkları çıktı kuyruklarıyla raporlar ve
en az bir hata varsa 1 ile çıkar.

## Davranış kuralları

- Testler sırayla koşar (deterministik ve paylaşılan geçici dosyalara güvenli),
  syntax kontrolleri paralel koşar.
- Test çıktısı hata raporunda son 64 KB ile sınırlıdır.
- `scripts/test-redis-schedule-lease-live.mjs` gibi canlı servis testleri
  ortam değişkeni yoksa kendi içinde atlanır; runner bunları özel-durum olarak
  bilmez.
- `scripts/test-check-gate.mjs` kapsamın geri kaymasını engeller: diskteki her
  test keşfedilmeli, `package.json` gate'i runner'a devretmeli ve tekrar test
  dosyası adı gömmemelidir.

## Geri alma

`package.json` içindeki `check`/`precheck` script'leri eski zincire döndürülebilir;
`scripts/run-checks.mjs` ve `scripts/test-check-gate.mjs` silinebilir. Test veya
kaynak dosyalarında bu değişikliğe bağlı bir bağımlılık yoktur.
