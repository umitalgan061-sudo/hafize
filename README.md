# Hafize

Hafize, NVIDIA NIM modelleri üzerinde çalışan; streaming ve tool-calling
destekleyen, zamanlanmış görevleri bulutta yürütebilen, PWA olarak kurulabilen
ve kullanıcı izniyle GitHub / Google / Gmail / Canva ile bağlanabilen kişisel
bir yapay zekâ çalışma alanıdır.

Geliştirme kuralları ve tur bütçesi için önce [`HAFIZE_RULES.md`](HAFIZE_RULES.md)
okunur.

## Çalıştırma

```bash
npm install
npm start            # varsayılan http://127.0.0.1:4173
npm run check        # tüm syntax kontrolleri + tüm testler
```

Bağımlılık yalnızca `redis` (opsiyonel schedule lease adapter'ı içindir);
uygulama Node.js standart kütüphanesiyle çalışır.

## Yapı

| Yol | İçerik |
| --- | --- |
| `server.mjs` | HTTP sunucusu, statik dosyalar, `/api/*` uçları |
| `lib/` | Sunucudan bağımsız, tek sorumluluklu ve test edilebilir modüller |
| `public/` | PWA istemcisi (sohbet arayüzü, ses, ekran paylaşımı, service worker) |
| `agents/registry.json` | Ajan kataloğu ve her ajanın izinli tool listesi |
| `scripts/` | Test ve doğrulama script'leri, check runner |
| `docs/` | Her güvenlik sınırı ve sözleşme için ayrı karar kaydı |

### API uçları

- `GET /api/health`, `GET /api/models`, `GET /api/agents`
- `POST /api/chat` — streaming sohbet, otomatik context compaction ile
- `POST /api/agent/run` — registry içindeki bir ajanı çalıştırır
- `GET|POST /api/schedules[/...]` — zamanlanmış görevler (auth zorunlu)
- `GET /api/connectors/{canva,gmail}/status` — bağlantı durumu (secret içermez)

## Ortam değişkenleri

Secret'lar yalnız backend ortam değişkeni olarak verilir; hiçbiri `public/`
altına, istemci JavaScript'ine veya repoya yazılmaz.

| Değişken | Amaç |
| --- | --- |
| `NVIDIA_API_KEY`, `NIM_BASE_URL` | NVIDIA NIM sağlayıcısı |
| `GITHUB_TOKEN`, `HAFIZE_GITHUB_READ_REPOS` | salt-okunur GitHub dosya erişimi |
| `HAFIZE_SCHEDULE_AUTH_TOKEN`, `HAFIZE_SCHEDULE_AUTH_SUBJECT` | schedule API kimliği |
| `HAFIZE_SCHEDULE_TICK_MS`, `HAFIZE_SCHEDULE_RUN_TIMEOUT_MS`, `HAFIZE_SCHEDULE_MODEL` | schedule worker ayarları |
| `HAFIZE_CONTEXT_LIMIT_TOKENS` | context compaction eşiği |
| `PORT`, `HOST` | sunucu adresi |

## Güvenlik sınırları

- Backend default-deny'dir: model yalnız ajan politikasının izin verdiği ve
  gerçekten yapılandırılmış araçları görür (`lib/tool-runtime.mjs`).
- Kayıtlı NVIDIA araçları salt-okunurdur; dış servislerde yazma/gönderme
  işlemleri açık kullanıcı onayı olmadan araç olarak sunulmaz.
- Tool sonuçlarının kullanıcıya dönen aktivite etiketleri repo adı, dosya yolu,
  token veya iç hata detayı içermez.
- OAuth token'ları şifreli, owner kapsamlı store'da tutulur.

Ayrıntılar `docs/` altındaki ilgili karar kaydındadır; kalite kapısı
[`docs/CHECK_GATE.md`](docs/CHECK_GATE.md) içinde anlatılır.
