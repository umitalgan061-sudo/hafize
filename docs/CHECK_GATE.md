# Doğrulama kapısı (check gate)

Bu belge Hafize'nin test/sözdizimi kapısının nasıl çalıştığını ve neden
keşif (discovery) tabanlı olduğunu açıklar.

## Komutlar

| Komut | Kapsam |
| --- | --- |
| `npm run check` | Tüm kapı: `.`/`lib`/`scripts` altındaki `.mjs` ve `public` altındaki `.js` dosyaları için `node --check`, ardından `scripts/validate-agent-registry.mjs` ve **tüm** `scripts/test-*.mjs` dosyaları. |
| `npm run precheck` | Yalnız UI/istemci alt kümesi (voice, ui-shell, sidebar, hands-free, screen-share). Hızlı geri bildirim içindir, `check` yerine geçmez. |
| `npm run check:list` | Hiçbir şey çalıştırmadan kapının o anki kapsamını listeler. |
| `node scripts/run-checks.mjs --only=schedule-,oauth-` | Ada göre filtrelenmiş yerel koşu. |

Kapı sıfır dışı çıkış kodu ile başarısız olur ve sonunda başarısız dosyaları
tek listede özetler. Her betik 180 saniye zaman aşımına tabidir; asılı kalan
bir test kapıyı süresiz bloklamaz.

## Neden keşif tabanlı?

Kapı daha önce `package.json` içinde elle bakımı yapılan tek satırlık bir
`&&` zinciriydi. Yeni bir test dosyası eklenip zincire yazılmadığında test
sessizce hiç çalışmıyordu — hata vermediği için fark edilmiyordu.

2026-09-02 taramasında bu yolla **85 test dosyasının 33'ü** kapının tamamen
dışında kalmıştı: tüm OAuth (`test-oauth-*`), Canva token akışları, Google
token exchange, personal-memory runtime/encryption, device bridge, hands-free
ve screen-share testleri dâhil. Aynı elle bakım kaynaklı sürüklenme kapıyı
kırmıştı da: `scripts/test-tool-runtime.mjs` kayıtlı araç listesini birebir
karşılaştırıyordu ve `canva_read` ile `gmail_read` araçları kaydedildikten
sonra güncellenmemişti; bu yüzden `npm run check` `main` üzerinde kırmızıydı
ve zincir orada durduğu için ardındaki testler de hiç çalışmıyordu.

`scripts/run-checks.mjs` kapsamı diskten okur. Yeni bir `scripts/test-*.mjs`
dosyası eklendiği anda kapıya girer; ayrı bir kayıt adımı yoktur ve zincirin
ortasında duran bir hata kalan testleri gizlemez.

## Test yazma sözleşmesi

- Test dosyaları `scripts/test-<konu>.mjs` adlandırmasını kullanır; keşif bu
  önekle çalışır.
- Bir test başarılıysa kısa bir onay satırı yazar ve `0` ile çıkar;
  başarısızsa `node:assert/strict` üzerinden atar.
- Testler harici ağ, canlı Redis veya gerçek kimlik bilgisi gerektirmez.
  Opsiyonel altyapı isteyen testler (`test-redis-schedule-lease-live.mjs`)
  altyapı yoksa kendini atlar ve yine `0` ile çıkar.
- Kayıtlı araç listesi gibi birebir karşılaştırmalar yapan testler, listeye
  yeni giren her öğe için türetilmiş kontrol de içermelidir; böylece
  güncellenmemiş bir sabit tüm kapıyı kırmak yerine eksik olanı adıyla
  raporlar.

## Geri alma

`scripts/run-checks.mjs` tek dosyadır ve mevcut testlerin hiçbirini
değiştirmez. `package.json` içindeki `check`/`precheck` komutları eski
zincire geri döndürülerek davranış aynen geri alınabilir.
