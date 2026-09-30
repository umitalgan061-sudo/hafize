# Konuşma Dalları

Konuşma dalları, mevcut bir sohbetin belirli bir mesajından başlayarak yerel, bounded bir kopya
üzerinde alternatif bir yol açma özelliğidir. Parent sohbet değiştirilmez; fork yalnızca seçilen
noktaya kadar olan mesajların kopyasını taşır.

Bu dosya özelliğin giriş noktasıdır. Ayrıntılar `docs/CONVERSATION_FORKS_*.md` dosyalarındadır.

## Kapsam

- Fork akışı yalnızca cihazda çalışır; kendi başına network isteği veya telemetry kaydı üretmez.
- Veri `hafize.conversations.v1` localStorage anahtarında tutulur.
- Fork metadata'sı `forkOf`, `forkMessageId`, `forkDepth` ve `forkNote` alanlarıyla sınırlıdır.
- İlk API çağrısı yalnızca kullanıcı yeni dalda mesaj gönderdiğinde mevcut chat akışından gelir.

## Kod haritası

| Dosya | Sorumluluk |
|---|---|
| `public/typed/conversation-fork-core.ts` | Saf fork mantığı: limitler, lineage, snapshot |
| `public/typed/conversation-fork-core.test.ts` | Core davranış testleri |
| `public/typed/conversation-forks.ts` | DOM yüzeyi: mesaj eylemleri, dialog, banner, hub |
| `public/typed/app-shell.ts` | Conversation kaydı, `hafize:open-conversation` olayı |
| `public/conversation-forks.css` | Panel, banner, hub ve karşılaştırma stilleri |

## Limitler

Özet: 30 conversation, parent başına 8 doğrudan dal, 4 dal derinliği, fork başına 100 mesaj,
80 karakter dal adı, 400 karakter dal notu. Tam tablo `CONVERSATION_FORKS_LIMITS.md` dosyasındadır.

## Belge dizini

### Kullanım
- `CONVERSATION_FORKS_USER_GUIDE.md` — adım adım kullanıcı akışı
- `CONVERSATION_FORKS_USER_FLOWS.md` — uçtan uca kullanıcı senaryoları
- `CONVERSATION_FORKS_EXAMPLES.md` — örnek fork kurguları
- `CONVERSATION_FORKS_SUPPORT.md` — destek soruları

### Tasarım ve veri
- `CONVERSATION_FORKS_DATA_MODEL.md` — saklanan alanlar ve şema
- `CONVERSATION_FORKS_LIMITS.md` — bounded limit tablosu
- `CONVERSATION_FORKS_EVENTS.md` — DOM olay sözleşmesi
- `CONVERSATION_FORKS_DESIGN_REVIEW.md` — tasarım kararları
- `CONVERSATION_FORKS_RECOVERY_FORMAT.md` — dal yedeği JSON biçimi
- `CONVERSATION_FORKS_MIGRATION.md` — eski kayıtların yükseltilmesi

### Güvenlik ve gizlilik
- `CONVERSATION_FORKS_PRIVACY.md` — veri cihazda kalma garantileri
- `CONVERSATION_FORKS_SECURITY_REVIEW.md` — güvenlik incelemesi
- `CONVERSATION_FORKS_THREAT_MODEL.md` — tehdit modeli

### Kalite
- `CONVERSATION_FORKS_TESTING.md` — test haritası
- `CONVERSATION_FORKS_ACCEPTANCE.md` — kabul kriterleri
- `CONVERSATION_FORKS_QA_RUNBOOK.md` — manuel QA adımları
- `CONVERSATION_FORKS_SCENARIOS.md` — regresyon senaryoları
- `CONVERSATION_FORKS_BROWSER_MATRIX.md` — tarayıcı matrisi
- `CONVERSATION_FORKS_PERFORMANCE.md` — performans bütçesi
- `CONVERSATION_FORKS_FAILURE_RECOVERY.md` — hata kurtarma

### Sürüm
- `CONVERSATION_FORKS_RELEASE.md` — yayın kapısı
- `CONVERSATION_FORKS_CHANGELOG.md` — değişiklik kaydı
- `CONVERSATION_FORKS_ROLLBACK.md` — geri alma yolu
- `CONVERSATION_FORKS_ROLLBACK_CHECKLIST.md` — geri alma kontrol listesi
- `CONVERSATION_FORKS_OBSERVABILITY.md` — gözlemlenebilirlik notları
- `CONVERSATION_FORKS_DEVELOPER.md` — geliştirici notları

## Kontroller

```bash
node scripts/run-checks.mjs --filter=conversation-forks
```
