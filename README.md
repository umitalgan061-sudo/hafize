# Hafize

Hafize, NVIDIA NIM modelleri üzerinde çalışan; Claude-benzeri sade bir sohbet
deneyimi sunan, zamanlanmış agent görevlerini uygulama kapalıyken de yürütebilen
ve kullanıcı izniyle GitHub / Google / Gmail / Canva'ya bağlanabilen kişisel bir
yapay zekâ çalışma alanıdır.

Bağımlılık yüzeyi bilinçli olarak dardır: tek dış bağımlılık `redis`, geri kalan
her şey Node.js standart kütüphanesiyle yazılmıştır.

## Hızlı başlangıç

```bash
npm install
npm run check      # tüm gate: syntax + doğrulayıcılar + testler
npm start          # http://127.0.0.1:4173
```

`PORT` ve `HOST` ortam değişkenleriyle değiştirilebilir. Model çağrıları için
`NVIDIA_API_KEY` gerekir; anahtar yokken sunucu açılır ancak model uçları
yapılandırılmamış olarak raporlanır.

## Depo düzeni

| Dizin | İçerik |
| --- | --- |
| `server.mjs` | HTTP sunucusu, statik dosyalar ve `/api/*` uçları |
| `lib/` | Sunucu tarafı çekirdek: agent runtime, tool boundary'leri, OAuth, zamanlayıcı, bellek |
| `public/` | PWA istemcisi: sohbet arayüzü, service worker, ses ve ekran paylaşımı |
| `agents/registry.json` | Ajan tanımları ve izin listeleri |
| `scripts/` | Tüm testler ve doğrulayıcılar |
| `docs/` | Her alt sistemin sözleşme ve güvenlik notları |

Başlıca uçlar: `/api/health`, `/api/models`, `/api/chat`, `/api/agents`,
`/api/agent/run`, `/api/schedules`, `/api/connectors/{canva,gmail}/status`.

## Doğrulama

Gate elle bakım gerektiren bir komut zinciri değildir; `scripts/run-checks.mjs`
kaynak dosyaları ve testleri dizinden keşfeder, paralel çalıştırır ve tüm
hataları tek turda raporlar.

| Komut | Kapsam |
| --- | --- |
| `npm run check` | Tam gate |
| `npm run precheck` | Yalnızca frontend/UX testleri (hızlı döngü) |
| `npm run check:live` | Canlı bağımlılık gerektiren testler dâhil |
| `npm run check:plan` | Planı çalıştırmadan JSON olarak yazdırır |

Ayrıntı ve dışlama kuralı için `docs/CHECK_GATE.md`.

## Güvenlik sınırları

- API anahtarları ve OAuth secret'ları yalnızca backend ortam değişkenlerinde
  tutulur; `public/`, istemci JavaScript'i veya manifest içine hiçbir zaman
  yazılmaz ve repoya commit edilmez.
- OAuth token'ları ve kişisel bellek diskte şifreli saklanır; şifreleme
  anahtarları ortam değişkeninden okunur.
- İstemciye dönen araç aktiviteleri yalnızca sabit etiket ve durum içerir;
  dosya içeriği, e-posta metni, repo adı veya token sızdırmaz.
- Dış servislerde yazma işlemleri (ör. Gmail gönderimi) açık kullanıcı onayı
  olmadan çalışmaz ve yazma araçları model tool catalog'una kayıtlı değildir.
- Yetkilendirme ajan bazlıdır: bir araç ancak ajanın izin listesinde varsa ve
  ilgili connector kimlik doğrulamasından geçmişse açılır.

Yapılandırma için okunan ortam değişkenleri (yalnızca isimler):
`NVIDIA_API_KEY`, `NIM_BASE_URL`, `GITHUB_TOKEN`, `HAFIZE_GITHUB_READ_REPOS`,
`HAFIZE_CONTEXT_LIMIT_TOKENS`, `HAFIZE_SCHEDULE_*`, `HAFIZE_CONNECTOR_*`,
`HAFIZE_OAUTH_TOKEN_*`, `HAFIZE_MEMORY_*`.

## Katkı akışı

Geliştirme kuralları, tur bütçesi ve öncelik sırası `HAFIZE_RULES.md` içindedir.
Değişiklikler ayrı bir branch üzerinde yapılır, `npm run check` yeşil olmadan
Pull Request hazırlanmaz ve self-development değişiklikleri doğrudan `main`
üzerine merge edilmez.

Üçüncü taraf bildirimleri: `THIRD_PARTY_NOTICES.md`.
