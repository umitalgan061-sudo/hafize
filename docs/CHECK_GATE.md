# Check gate (`npm run check`)

Hafize'nin tek doğrulama kapısı `node scripts/run-checks.mjs` komutudur. Kapı elle bakımlı bir dosya listesi değildir; her çalıştırmada depoyu tarar.

## Ne çalıştırır?

1. **Syntax kontrolü** — `server.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js` dosyalarının tamamı için `node --check`.
2. **Agent registry doğrulaması** — `scripts/validate-agent-registry.mjs`.
3. **Testler** — `scripts/test-*.mjs` kalıbına uyan bütün betikler, alfabetik sırada, her biri ayrı child process içinde ve 120 saniyelik zaman aşımıyla.

Kapı ilk hatada durmaz: bütün kontroller çalışır, başarısız olanların çıktısı sonda toplu olarak yazılır ve süreç `1` ile biter. Böylece tek turda birden fazla kırık kontrol görülebilir.

## Neden keşif tabanlı?

Kapı daha önce `package.json` içinde elle yazılmış tek satırlık uzun bir `&&` zinciriydi. Yeni test dosyaları o zincire eklenmediği için sessizce kapı dışında kaldı: 85 test betiğinin 32'si — OAuth, PKCE, token şifreleme, Canva/Gmail read client ve device bridge testlerinin tamamı dâhil — hiç çalışmıyordu. Zincir ayrıca ilk hatada durduğu için, kapının kendisi kırmızıyken arkasındaki testler de hiç çalışmıyordu.

`scripts/test-check-gate.mjs` bu gerilemeyi kalıcı olarak engeller:

- diskteki her `scripts/test-*.mjs` dosyasının keşif sonucunda bulunduğunu,
- her `lib/*.mjs`, `public/*.js` ve `server.mjs` dosyasının syntax hedefi olduğunu,
- `package.json` içindeki `check` betiğinin yalnızca runner'a devrettiğini ve hiçbir npm betiğinin tek tek test dosyası saymadığını

doğrular. Kapı yeniden elle bakımlı bir listeye dönerse bu test kırılır.

## Yeni test eklerken

Dosyayı `scripts/test-<konu>.mjs` adıyla oluşturmak yeterlidir; başka hiçbir yere kayıt gerekmez. Hata durumunda betik sıfırdan farklı bir çıkış kodu üretmelidir (`node:assert/strict` bunu kendiliğinden yapar).

Dış bağımlılık isteyen testler ortam değişkeni yokken atlanmalıdır — `scripts/test-redis-schedule-lease-live.mjs` bunun örneğidir: `HAFIZE_TEST_REDIS_URL` tanımlı değilse bilgi mesajı yazıp `0` ile çıkar. Kapı ağ erişimi, secret veya canlı servis gerektirmez.

## Bilinen takip işi

Karanlıkta kalan testler kapıya alınınca ortaya çıkan hata sınıfı — giriş nesnesini `= {}` varsayılanıyla destructure eden ve `null` girişte sözleşme hatası yerine ham `TypeError` üreten fonksiyonlar — model ve HTTP tarafından erişilebilen sınırlarda giderildi: Gmail/Canva read, Gmail send, schedule command boundary, schedule worker ve scheduled agent executor.

Aynı kalıp yalnızca dâhilî çağrılanlarda (OAuth token store, Redis lease adapter, task ledger, model provider router gibi) hâlâ duruyor. Bunlar çağrı tarafından her zaman nesne aldığı için canlı hata üretmiyor; tur bütçesi gereği ayrı bir tura bırakıldı.

## Geri alma

Kapı davranışı tek dosyada toplandığı için `scripts/run-checks.mjs` ve `package.json` içindeki `check` satırı geri alındığında eski davranışa dönülür.
