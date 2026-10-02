# Konuşma Dalları

Konuşma dalları, bir sohbetin seçilen bir mesajına kadar olan bölümünü yeni bir
yerel sohbete kopyalayarak alternatif bir yol açmayı sağlar. Parent sohbet
değişmez; dal yalnızca cihazda tutulur ve kendi başına hiçbir ağ isteği
üretmez.

## Çalışma şekli

| Katman | Dosya | Sorumluluk |
|---|---|---|
| Çekirdek | `public/typed/conversation-fork-core.ts` | Fork kuralları, limitler, soy ağacı, yedek anlık görüntüsü |
| Arayüz | `public/typed/conversation-forks.ts` | Dallandırma düğmeleri, onay penceresi, dal paneli, dal yedeği |
| Stil | `public/conversation-forks.css` | Dal bandı, dal merkezi ve karşılaştırma görünümü |

Fork verisi `hafize.conversations.v1` anahtarında, mevcut sohbet kayıtlarının
yanında saklanır. Her dal kaydı `forkOf`, `forkMessageId`, `forkDepth` ve
isteğe bağlı `forkNote` alanlarını taşır.

## Akış

1. Bir user veya assistant mesajında **Buradan dallandır** seçilir.
2. Onay penceresi taşınacak mesaj sayısını, kısa bir önizlemeyi, dal adını ve
   dal notunu gösterir.
3. Onaylandığında `createFork` seçilen mesaja kadarki mesajların bounded bir
   kopyasını üretir ve yeni sohbeti açar.
4. **Dal yedeği**, aktif dalı `buildForkSnapshot` biçiminde JSON olarak indirir.

## Limitler

Limitler `FORK_LIMITS` içinde tek kaynaktan gelir: 30 sohbet, parent başına 8
doğrudan dal, 4 dal derinliği, fork başına 100 mesaj. Ayrıntılı tablo
`CONVERSATION_FORKS_LIMITS.md` dosyasındadır.

## Doğrulama

```bash
npx vitest run public/typed/conversation-fork-core.test.ts
node scripts/test-conversation-forks-regression.mjs
node scripts/test-conversation-forks-backup.mjs
```

## İlgili dokümanlar

- `CONVERSATION_FORKS_USER_GUIDE.md` — kullanıcı akışı
- `CONVERSATION_FORKS_DATA_MODEL.md` — kayıt şeması
- `CONVERSATION_FORKS_LIMITS.md` — limit tablosu
- `CONVERSATION_FORKS_PRIVACY.md` — veri sınırları
- `CONVERSATION_FORKS_RECOVERY_FORMAT.md` — yedek biçimi
- `CONVERSATION_FORKS_RELEASE.md` — çıkış kontrolleri
