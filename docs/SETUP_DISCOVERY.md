# Yapılandırma keşfi

Bu belge, Hafize'nin kendi yapılandırma durumunu operatöre nasıl bildirdiğini tanımlar. Kullanıcıya dönük kurulum adımları için `docs/KURULUM.md`, değişken listesi için `.env.example`.

## Sorun

Hafize 27 ortam değişkeni okuyor ve bunların hiçbiri belgeli değildi. Üç ayrı başarısızlık biçimi vardı:

1. **Sessiz kapalı özellik.** `GITHUB_TOKEN` tanımlı ama `HAFIZE_GITHUB_READ_REPOS` boşsa `github_read_file` aracı ajanlara hiç sunulmuyordu. Operatör özelliği açtığını sanıyordu.
2. **Açılışta ham çökme.** Connector değişkenlerinin bir kısmı tanımlanıp OAuth token deposu değişkenleri unutulursa sunucu `Cannot destructure property ...` benzeri bir stack trace ile kapanıyordu. Hangi değişkenin eksik olduğu görünmüyordu.
3. **Anlamsız sohbet hatası.** `NVIDIA_API_KEY` yoksa model listesi boş kalıyor ve arayüz yalnızca "NVIDIA NIM bağlantısı bekleniyor" diyordu; anahtarın eksik olduğu ya da nereye konacağı hiçbir yerde yazmıyordu.

## Grup modeli

`lib/setup-status.mjs` değişkenleri gruplara ayırır ve her grubu üç durumdan birine sokar:

| Durum | Anlam |
| --- | --- |
| `ready` | Grubun her değişkeni tanımlı; özellik açık. |
| `off` | Grubun hiçbir değişkeni tanımlı değil; özellik kapalı. Bu bir hata değildir. |
| `incomplete` | Grup yarım. Her zaman bir hatadır. |

`incomplete` grupların bir kısmı `fatalWhenPartial` işaretlidir: bunlar yarım bırakıldığında sunucu bir runtime fabrikasının içinde çökeceği için, açılış bilinçli olarak daha erken ve okunabilir bir mesajla durdurulur.

Ölümcül gruplar: connector kimliği, zamanlanmış görev API'si, zamanlanmış görev deposu, şifreli bellek.

## Açılış davranışı

`server.mjs` ajan kaydını yükledikten hemen sonra, connector ve zamanlama fabrikalarından **önce** durumu hesaplar:

- Ölümcül bir eksik varsa `formatFatalSetupError` yazılır ve süreç `exit(1)` ile durur.
- Aksi hâlde sunucu dinlemeye başlar ve `formatSetupStatus` özeti stdout'a yazılır.

Bu sıralama önemlidir: kontrol fabrikalardan sonra yapılsaydı ham stack trace yine önce çıkardı.

## Güvenlik

Bu katman değişken **değerlerini** hiçbir zaman okumaz. Rapora yalnızca değişken adları ve set/unset bilgisi girer. `scripts/test-setup-status.mjs` bunu doğrular: gerçekçi secret değerleri içeren bir ortamla rapor üretilir ve hiçbir değerin çıktıda geçmediği iddia edilir. `scripts/test-setup-status-startup.mjs` aynı iddiayı gerçek bir süreç için stdout ve stderr üzerinde tekrarlar.

## Arayüz tarafı

`NVIDIA_API_KEY` tanımlı değilse `public/index.html` içindeki `#setupNotice` paneli görünür olur. Panel `/api/health` yanıtındaki `nvidiaConfigured` bayrağına bakar; sağlık isteği başarısız olursa panel gizli kalır, çünkü başarısız bir istek anahtarın eksik olduğunun kanıtı değildir.

Panel kullanıcıdan anahtar istemez ve anahtar girilecek bir alan içermez; anahtarın yeri sunucu ortamıdır.

## Geçersiz anahtar

NVIDIA'nın `/v1/models` ucu kimlik doğrulaması istemez. Bu yüzden geçersiz bir anahtarla model listesi normal biçimde dolar ve hata ancak ilk mesaj gönderildiğinde ortaya çıkar. Sunucu bu durumu ayırt eder: upstream 401 veya 403 dönerse hata kodu `NVIDIA_CHAT_ERROR` değil `NVIDIA_AUTH_FAILED` olur ve arayüz anahtarın reddedildiğini söyler.

Ayrım üç yolda birden yapılır: JSON tamamlama, düz streaming ve tool-calling sonrası streaming.

## Doğrulama

| Betik | Kapsam |
| --- | --- |
| `test-setup-status.mjs` | Grup sınıflandırması, ölümcül gruplar, secret sızıntısı, `.env.example` senkronu |
| `test-setup-status-startup.mjs` | Gerçek süreç: ölümcül çıkış kodu ve mesajı, açılış özeti, anahtar sızıntısı |
| `test-setup-notice-wiring.mjs` | Arayüz paneli, sağlık bayrağı adı ve sunucu sözleşmesi arasındaki bağ |
| `test-nvidia-auth-failure.mjs` | 401/403 ayrımı ve kullanıcıya dönük mesaj |

`.env.example` senkron testi bilinçlidir: koda yeni bir değişken eklenip örnek dosyaya eklenmezse `npm run check` başarısız olur.

## Geri alma

`lib/setup-status.mjs`, dört test betiği, `.env.example`, `.gitignore`, `docs/KURULUM.md` ve `docs/SETUP_DISCOVERY.md` silinir; `server.mjs` içindeki `SETUP_STATUS` bloğu, `isNvidiaAuthFailure` yardımcısı ve `formatSetupStatus` çağrısı kaldırılır; `public/` tarafında `#setupNotice` paneli, `refreshSetupNotice` fonksiyonu ve `.setup-notice` stilleri geri alınır.
