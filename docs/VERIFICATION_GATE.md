# Doğrulama kapısı ve connector sınır sertleştirmesi

## Sorun

Kapı (`npm run check`) `package.json` içinde elle bakılan tek bir uzun komut dizisiydi. Yeni modül veya yeni test eklendiğinde bu dizeye eklenmediği sürece hiçbir zaman çalışmıyordu.

Bu turda ölçülen durum:

- Depodaki 85 test betiğinden **32'si kapı kapsamı dışındaydı** — aralarında OAuth PKCE, token exchange, token file store, token encryption ve personal memory encryption gibi tüm güvenlik yüzeyi vardı.
- Kapı zaten **kırmızıydı**: `scripts/test-tool-runtime.mjs` donmuş bir tool katalog literal'i ile karşılaştırma yapıyordu; katalog `canva_read` ve `gmail_read` ile büyüyünce test kırıldı. `&&` zinciri orada durduğu için zincirin geri kalanı hiç çalışmadı ve `lib/gmail-read-client.mjs` içindeki ikinci hata görünmez kaldı.

## Keşif tabanlı runner

`scripts/run-checks.mjs` kaynakları ve testleri diskten keşfeder:

- syntax: `server.mjs`, `lib/*.mjs`, `public/*.js`, `scripts/*.mjs` → `node --check`
- test: `scripts/test-*.mjs` → tek tek çalıştırılır
- `scripts/validate-agent-registry.mjs` ayrı adım olarak koşar

Davranış:

- Kapsam listesi elle güncellenmez; yeni dosya eklendiği anda kapıya girer.
- İlk hatada durulmaz; **tüm** başarısızlıklar toplanır ve sonunda birlikte raporlanır.
- Her adımın 120 sn timeout'u vardır; asılı kalan bir test kapıyı sonsuza kadar bekletmez.
- Hiç hedef bulunamazsa runner sessizce başarılı olmaz, hata verir.

Komutlar:

| Komut | Kapsam |
| --- | --- |
| `npm run check` | 159 syntax kontrolü + 85 test + registry doğrulaması |
| `npm run check:syntax` | yalnız syntax kontrolleri (hızlı döngü) |

`precheck` kaldırıldı; içeriği tam kapsama dahil olduğu için ayrı bir elle bakılan liste tutmak drift kaynağıydı.

`scripts/test-redis-schedule-lease-live.mjs` canlı Redis ister ve `HAFIZE_TEST_REDIS_URL` yoksa kendini atlar; runner bunu özel durum olarak tanımaz, betiğin kendi opt-in davranışına güvenir.

## Tool katalog değişmezleri

`scripts/test-tool-runtime.mjs` artık donmuş bir liste yerine değişmez doğrular:

- çekirdek üç araç (`runtime_status`, `agent_delegate`, `github_read_file`) katalog başında ve sırada kalır;
- katalogdaki hiçbir yetki, registry'de herhangi bir ajanın `deny` veya `approvalRequired` listesinde bulunamaz;
- `*.write`, `*.send`, `*.delete`, `*.merge`, `*.revoke` ve `secret.*` yetkileri araç olarak açılamaz;
- yinelenen yetki veya yinelenen fonksiyon adı bulunamaz;
- katalogdaki her yetki, en az bir ajanın `allow` listesinde karşılığı olmalıdır.

Böylece yeni bir **salt-okunur** connector aracı eklemek testi kırmaz, ama yazma/gönderme yetkisi taşıyan bir araç eklemek kırar.

## Connector sınırlarında ham TypeError sızıntısı

Beş connector giriş noktası `null` veya nesne olmayan girdide sözleşme hatası yerine ham `TypeError` fırlatıyordu. Hata kodlarına göre dallanan çağırıcılar bu şekli beklemiyor:

| Giriş noktası | Önce | Sonra |
| --- | --- | --- |
| `gmailReadClient.read(null)` | `TypeError` | `INVALID_GMAIL_READ:request` |
| `canvaReadClient.read(null)` | `TypeError` | `INVALID_CANVA_READ:request` |
| `gmailReadBoundary.execute(args, null)` | `TypeError` | `INVALID_GMAIL_READ_TOOL:context` |
| `canvaReadBoundary.execute(args, null)` | `TypeError` | `INVALID_CANVA_READ_TOOL:context` |
| `gmailSendBoundary.execute(args, null)` | `TypeError` | `INVALID_GMAIL_SEND_TOOL:context` |

Onay davranışı korunur: context hiç verilmezse `approvalGranted` yine `false` sayılır ve `gmail_send` `GMAIL_SEND_APPROVAL_REQUIRED` ile reddedilir; send client çağrılmaz. Bozuk context'te owner çözümlemesi ve okuma/gönderme çağrısı hiç yapılmaz.

## Geri alma

- Kapı: `package.json` içindeki `check` script'i eski dizeye döndürülür ve `scripts/run-checks.mjs` silinir.
- Sınır sertleştirmesi: ilgili beş `lib/` dosyasındaki giriş doğrulaması ve eklenen test blokları geri alınır.
