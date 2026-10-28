# Geliştirici araçları (test runner + salt-okunur git)

`lib/dev-tools.ts`, ajanın kod tabanını "anla → değiştir → test et → commit at" döngüsünü
çalıştırmasını sağlayan iki aracı taşır: yapılandırılmış test koşucusu ve salt-okunur git
kömütüsü. Her ikisi de `local-tools.ts` ile aynı çalışma klasörü sınırını kullanır.

## `test_run` (permission `test.run`)

Yalnızca **bilinen komutlar** koşturulur. Liste dışındaki her şey `UNSUPPORTED_TEST_COMMAND`
ile reddedilir; keyfi komut çalıştırmak isteyen ajan `shell_run` + kullanıcı onayı kullanmalıdır.

| Kabul edilen komut |
| --- |
| `npm test` |
| `npm run test` |
| `npx vitest run` |
| `npx jest` |
| `npx pytest` |
| `go test ./...` |

- `scope` (ör. tek bir test dosyası) yalnız `^[a-zA-Z0-9_./-]+$` desenine uyabilir; kabuk
  enjeksiyonu taşıyamaz.
- Zaman aşımı 5 sn – 5 dk arası, varsayılan 120 sn.
- Sunucunun environment'ındaki `KEY|TOKEN|SECRET|PASSWORD|...` değişkenleri test sürecine
  **geçirilmez**.
- Her koşu `workspace/.hafize-test-results/<runId>.json` dosyasına yazılır.

Çıktı `{ runId, command, scope?, ok, exitCode, timedOut, durationMs, startedAt, stdout, stderr }`
biçimindedir. Başarısız bir test de kayıt üretir — "testler kırmızı" bilgisi bir sonraki
tura taşınabilir.

## `test_read_result` (permission `test.read_result`)

- `runId` verilirse o koşuyu okur; yoksa en son koşuyu döndürür.
- `runId` yalnız `^run_[a-z0-9]{1,24}$` desenine uyabilir (`INVALID_TEST_RUN_ID`).
- Bilinmeyen id → `TEST_RUN_NOT_FOUND` (404).

Bu ayrımın nedeni: test sonucu bilgisi tek bir tool çağrısında taşınamayacak kadar büyük
olabilir. Ajan önce koşar, sonra gerektiğinde okur.

## `git_run` (permission `repo.read`)

`workspace` içindeki git deposunda **salt-okunur** komut çalıştırır:

`status`, `diff`, `log`, `show`, `branch`, `remote`, `rev-parse`, `ls-files`, `blame`,
`describe`, `tag`, `config`.

- Yazma fiilleri (`push`, `commit`, `checkout`, `reset`, ...) tool katmanında
  `GIT_WRITE_NOT_ALLOWED` (403) ile reddedilir. Bunlar için ajan `shell_run` + kullanıcı
  onayı kullanmalıdır; yani durdurulamaz bir eylem her zaman insan onayından geçer.
- `--force`, `-f`, `--push*`, `--delete*` gibi bayraklar da reddedilir.
- Argüman sayısı 1–12, her biri en fazla 200 karakter; newline/null enjeksiyonu
  `INVALID_GIT_ARGS` ile durdurulur.
- Çıktı `redactPlaintextCredentials` ile temizlenir.

## Test

`npx vitest run lib/dev-tools.test.ts` — 7 test: liste dışı komut reddi, güvensiz scope reddi,
sonucun yazılıp geri okunması, geçersiz/bilinmeyen runId, boş/çok uzun git argüman listesi,
newline enjeksiyonu ve gerçek bir depoda salt-okunur komut.

## Kapsam dışı (bilinçli olarak yapılmayan)

- **LSP** (`go-to-definition`, rename, code action): ayrı bir Language Server süreci ve JSON-RPC
  köprüsü gerektirir. Şimdilik ajan `workspace_files` ile dosyayı okuyup kendi analizini
  yapıyor; gerçek LSP entegrasyonu ayrı bir modül olarak eklenmeli.
- **Debug adapter (DAP)**: hata ayıklama oturumu etkileşimli bir süreç ister; mevcut onay
  akışıyla uyumlu bir çözüm ayrı tasarım ister.
- **CI log okuma**: `github-read.ts` üzerinden GitHub API'ye bağlanmak gerekir; ayrı konu.
