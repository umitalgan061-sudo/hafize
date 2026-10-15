# Konuşma Dalları

Konuşma dalları, mevcut bir sohbetin belirli bir mesajından başlayarak cihaz üzerinde yeni bir yerel konuşma açmayı sağlar. Parent sohbet değiştirilmez; seçilen noktaya kadar olan mesajların bounded bir kopyası yeni dala taşınır.

Bu dosya özelliğin giriş noktasıdır; ayrıntılar `docs/CONVERSATION_FORKS_*.md` dosyalarındadır.

## Kaynak dosyalar

| Katman | Dosya |
| --- | --- |
| Fork çekirdeği (limitler, `createFork`, soy ağacı, snapshot) | `public/typed/conversation-fork-core.ts` |
| Çekirdek birim testleri | `public/typed/conversation-fork-core.test.ts` |
| Tarayıcı yüzeyi (dialog, panel, hub, banner, dal yedeği) | `public/typed/conversation-forks.ts` |
| Stil | `public/conversation-forks.css` |
| Vite entry | `conversation-forks` → `/typed-build/conversation-forks.js` |

## Davranış özeti

- Fork işlemi `createFork(source, messageId, all)` üzerinden yürür ve hata durumunda `MESSAGE_NOT_FOUND`, `DEPTH_LIMIT`, `BRANCH_LIMIT`, `CONVERSATION_LIMIT` veya `EMPTY_FORK` döner.
- Yeni dal `forkOf`, `forkMessageId`, `forkDepth` ve isteğe bağlı `forkNote` alanlarını taşır.
- Dal verisi `hafize.conversations.v1` anahtarında tutulur; fork kendi başına network isteği yapmaz.
- **Dal yedeği** düğmesi `buildForkSnapshot()` çıktısını `application/json` olarak indirir; aynı snapshot biçimi kurtarma akışında da kullanılır.
- `Ctrl / ⌘ + Shift + F` düzenlenebilir alan dışındayken son mesajdan fork akışını başlatır.

## Sınırlar

| Sınır | Değer |
| --- | --- |
| Toplam yerel konuşma | 30 |
| Parent başına doğrudan dal | 8 |
| Dal derinliği | 4 |
| Fork başına mesaj | 100 |
| Mesaj uzunluğu | 12000 karakter |
| Başlık | 80 karakter |
| Dal notu | 400 karakter |

Sınırların tek kaynağı `FORK_LIMITS` sabitidir; dokümandaki değerler bu sabitten türetilir.

## Doğrulama

```bash
node scripts/run-checks.mjs --filter=conversation-forks
```

Paketler kapsam olarak çekirdek davranışını (`test-conversation-forks-capacity`, `test-conversation-forks-parent`), tarayıcı yüzeyini (`test-conversation-forks-branch-panel`, `test-conversation-forks-banner`), PWA kaydını (`test-conversation-forks-pwa`) ve sürüm kapısını (`test-conversation-forks-release-gate`) kapsar.

## İlgili dokümanlar

- Kullanıcı akışı: `CONVERSATION_FORKS_USER_GUIDE.md`, `CONVERSATION_FORKS_USER_FLOWS.md`
- Veri ve biçim: `CONVERSATION_FORKS_DATA_MODEL.md`, `CONVERSATION_FORKS_RECOVERY_FORMAT.md`
- Güvenlik ve gizlilik: `CONVERSATION_FORKS_PRIVACY.md`, `CONVERSATION_FORKS_SECURITY_REVIEW.md`, `CONVERSATION_FORKS_THREAT_MODEL.md`
- Operasyon: `CONVERSATION_FORKS_QA_RUNBOOK.md`, `CONVERSATION_FORKS_ROLLBACK.md`, `CONVERSATION_FORKS_RELEASE.md`
