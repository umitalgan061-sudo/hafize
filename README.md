# Hafize

Hafize kişisel yapay zekâ çalışma alanı: Claude-benzeri sade bir sohbet
deneyimi üzerinde çalışan, NVIDIA NIM modellerini kullanan, streaming ve
tool-calling destekleyen, zamanlanmış agent görevlerini yürüten ve kullanıcı
izniyle GitHub / Gmail / Canva gibi servislere bağlanabilen bir uygulama.

## Çalıştırma

```bash
npm install
npm run check    # tüm doğrulama kapısı (syntax + registry + testler)
npm start        # varsayılan olarak http://127.0.0.1:4173
```

Node.js 22 gerekir. Tek çalışma zamanı bağımlılığı `redis`'tir (yalnızca
dağıtık schedule lease'i için; ayarlanmazsa dosya tabanlı adapter kullanılır).

## Depo yapısı

| Dizin | İçerik |
| --- | --- |
| `server.mjs` | HTTP sunucusu, statik dosyalar ve `/api/*` uçları |
| `lib/` | Sunucu tarafı modüller: agent runtime, tool runtime, OAuth, schedule, memory |
| `public/` | İstemci: sohbet arayüzü, PWA service worker, ses ve ekran paylaşımı |
| `scripts/` | Doğrulama kapısı ve tüm test suite'leri |
| `agents/registry.json` | Ajan tanımları ve araç izin politikaları |
| `docs/` | Modül sözleşmeleri ve güvenlik sınırları |

## HTTP uçları

- `GET /api/health` — sağlık durumu
- `GET /api/models` — kullanılabilir NIM modelleri
- `POST /api/chat` — streaming sohbet
- `GET /api/agents`, `POST /api/agent/run` — ajan çalıştırma
- `GET|POST /api/schedules`, `/api/schedules/:id` — zamanlanmış görevler
- `GET /api/connectors/gmail/status`, `GET /api/connectors/canva/status` — connector durumu

## Yapılandırma

Tüm secret'lar yalnızca ortam değişkeni olarak verilir; hiçbiri repoya veya
`public/` altına yazılmaz. Başlıca değişkenler: `NVIDIA_API_KEY`,
`NIM_BASE_URL`, `GITHUB_TOKEN`, `HAFIZE_GITHUB_READ_REPOS`,
`HAFIZE_SCHEDULE_AUTH_TOKEN`, `HAFIZE_SCHEDULE_AUTH_SUBJECT`, `PORT`, `HOST`.

## Geliştirme kuralları

Her geliştirme turu `HAFIZE_RULES.md` dosyasındaki akışa uyar: küçük, test
edilebilir ve geri alınabilir tek bir ana iyileştirme, ayrı branch ve Pull
Request. Doğrulama kapısının ayrıntıları için `docs/CHECK_GATE.md`.
