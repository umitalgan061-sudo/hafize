# Doğrulama geçidi (`npm run check`)

## Sorun

Geçit uzun süre `package.json` içinde elle tutulan tek bir `&&` zinciriydi. Bu iki
sessiz arıza sınıfı üretti:

1. **Zincir kopması.** `&&` ilk hatada durduğu için, zincirin başındaki bir test
   kırıldığında arkasındaki bütün testler hiç çalışmadı. `canva_read` aracı
   kayıt edildiğinde `scripts/test-tool-runtime.mjs` içindeki
   `listToolPermissions()` beklentisi güncellenmedi; geçit o commit'ten sonra
   54 commit boyunca kırmızıydı ve zincirin geri kalanı hiç yürütülmedi.
2. **Listeye eklenmeyi unutma.** Yeni test dosyası zincire elle eklenmediğinde
   hiç çalışmadı. Bu şekilde 33 test dosyası — OAuth, token şifreleme, PKCE,
   personal memory ve connector read client testlerinin tamamı dahil — geçidin
   dışında kalmıştı.

## Çözüm

`scripts/run-checks.mjs` kontrol listesini elle tutmaz, dosya keşfiyle üretir:

- **Syntax kontrolü:** `server.mjs`, tüm `lib/*.mjs`, tüm `public/*.js` ve tüm
  `scripts/*.mjs` dosyaları için `node --check`.
- **Testler:** `scripts/validate-agent-registry.mjs` ve keşfedilen tüm
  `scripts/test-*.mjs` dosyaları, alfabetik sırada.

Davranış kuralları:

- Geçit **fail-fast değildir**: bir test kırmızıya düşse de kalan testler
  çalışır, çıktının sonunda başarısız kontrollerin tam logu toplu olarak
  yazılır ve süreç `exit 1` ile biter.
- Her teste 120 saniyelik zaman aşımı uygulanır; asılı kalan bir test geçidi
  süresiz bloklamaz.
- `scripts/run-checks.mjs` ve `scripts/validate-agent-registry.mjs` test olarak
  keşfedilmez (`NON_TEST_SCRIPTS`); registry doğrulaması listenin başında ayrıca
  çalıştırılır.

## Yeni test eklerken

Ek bir adım yoktur. `scripts/test-*.mjs` adında bir dosya oluşturmak onu geçide
dahil etmek için yeterlidir. Test başarısızlığını sıfır olmayan çıkış koduyla
bildirmek testin kendi sorumluluğudur; `node:assert` kullanan mevcut testler bunu
zaten sağlar.

Dış servis gerektiren testler kendi içinde atlanmalıdır —
`scripts/test-redis-schedule-lease-live.mjs` `HAFIZE_TEST_REDIS_URL` yokken
atlayıp başarıyla çıkar. Bu davranış korunmalıdır; aksi hâlde geçit yerel
ortamda çalıştırılamaz hâle gelir.

## Geçidin kendisini doğrulama

Geçidin kırmızıya düşebildiği düzenli olarak sınanmalıdır: herhangi bir test
dosyasına geçici olarak başarısız bir assertion eklendiğinde `npm run check`
`exit 1` vermeli, o dosyayı `FAIL` olarak işaretlemeli ve diğer testleri
çalıştırmaya devam etmelidir.
