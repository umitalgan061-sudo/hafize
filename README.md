# Hafize

Hafize, NVIDIA NIM modelleri üzerinde çalışan; sohbet, zamanlanmış ajan
görevleri, PWA kurulumu, sesli kullanım ve kullanıcı izniyle bağlanan
GitHub / Google / Gmail / Canva araçlarını tek bir güvenli kişisel çalışma
alanında toplayan yapay zekâ uygulamasıdır.

## Çalıştırma

```bash
npm install
npm start           # varsayılan http://127.0.0.1:4173
npm run check       # tüm syntax ve test kapısı (~10 sn)
```

Tek çalışma zamanı bağımlılığı `redis`tir ve yalnız çok örnekli kurulumda
gerekir. Hiçbir zamanlama değişkeni verilmediğinde Hafize tek örnek olarak,
bellek içi zamanlama deposuyla çalışır; kalıcılık ve kira ayrı ayrı
etkinleştirilir.

## Yapı

| Yol | Sorumluluk |
| --- | --- |
| `server.mjs` | HTTP sunucusu, statik dosyalar, `/api/*` uçları, runtime wiring |
| `lib/` | Sözleşmeler ve çalışma zamanı modülleri (ajan, araç, connector, zamanlama, bellek) |
| `public/` | İstemci: sohbet kabuğu, PWA service worker, ses ve ekran paylaşımı |
| `agents/registry.json` | Ajan kataloğu ve ajan başına araç izin politikası |
| `scripts/` | Test paketleri ve kontrol kapısı koşucusu |
| `docs/` | Modül ve güvenlik sınırı sözleşmeleri |

Başlıca `/api` uçları: `/api/health`, `/api/models`, `/api/agents`,
`/api/agent/run`, `/api/chat`, `/api/schedules`,
`/api/connectors/canva/status`, `/api/connectors/gmail/status`.

## Yapılandırma

Tüm secret'lar yalnız backend ortam değişkeni olarak verilir; hiçbiri
`public/` altına veya repoya yazılmaz.

| Değişken | Amaç |
| --- | --- |
| `NVIDIA_API_KEY`, `NIM_BASE_URL` | NVIDIA NIM model sağlayıcısı |
| `HOST`, `PORT` | Sunucu bağlama adresi (varsayılan `127.0.0.1:4173`) |
| `HAFIZE_CONTEXT_LIMIT_TOKENS` | Otomatik context compaction eşiği |
| `GITHUB_TOKEN`, `HAFIZE_GITHUB_READ_REPOS` | Salt-okunur GitHub dosya aracı |
| `HAFIZE_SCHEDULE_AUTH_TOKEN`, `HAFIZE_SCHEDULE_AUTH_SUBJECT` | Zamanlama API kimliği |
| `HAFIZE_SCHEDULE_TICK_MS`, `HAFIZE_SCHEDULE_RUN_TIMEOUT_MS`, `HAFIZE_SCHEDULE_MODEL` | Zamanlama çalıştırıcısı |
| `HAFIZE_SCHEDULE_STORAGE_FILE`, `HAFIZE_SCHEDULE_STORAGE_KEY_BASE64` | Şifreli kalıcı zamanlama deposu |
| `HAFIZE_SCHEDULE_LEASE_PROVIDER`, `HAFIZE_SCHEDULE_LEASE_HOLDER_ID`, `HAFIZE_SCHEDULE_REDIS_URL` | Çok örnekli çalışmada kira sağlayıcısı |
| `HAFIZE_MEMORY_STORAGE_DIR`, `HAFIZE_MEMORY_KEY_B64` | Şifreli kişisel bellek deposu |

## Güvenlik sınırları

- Backend varsayılanı **default-deny**: model yalnız ajan politikasının izin
  verdiği ve gerçekten bağlı olan araçları görür.
- Dış servislerde yazma/gönderme işlemleri açık kullanıcı onayı ister;
  `gmail_send` bilerek NVIDIA araç kataloğuna kayıtlı değildir.
- OAuth token'ları şifreli olarak saklanır ve araç sonuçlarında kullanıcıya
  dönen metinlere sızmaz.

Ayrıntılı sözleşmeler için `docs/` altındaki belgelere, geliştirme akışı için
`HAFIZE_RULES.md` dosyasına bakın. Kontrol kapısının nasıl çalıştığı
`docs/CHECK_GATE.md` içinde anlatılır.
