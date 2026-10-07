# Konuşma Dalları

Konuşma dalları (fork), mevcut bir sohbetin seçilen bir mesajına kadar olan bölümünü
yeni ve bağımsız bir yerel konuşmaya kopyalar. Amaç, aynı bağlamdan farklı yönlere
gidebilmek; bunu yaparken üst sohbeti değiştirmemek.

## Neden

Uzun bir sohbette yönü değiştirmek iki kötü seçenek bırakır: ya geçmişi bozarak
devam etmek ya da sıfırdan başlayıp bağlamı yeniden anlatmak. Fork üçüncü yolu açar:
seçilen noktaya kadarki bağlam korunur, yeni dal kendi başına ilerler, üst sohbet
olduğu gibi kalır.

## Temel davranış

- Herhangi bir user veya assistant mesajındaki **Buradan dallandır** eylemi onay
  penceresini açar; pencere taşınacak mesaj sayısını, kısa bir önizlemeyi, özel dal
  adını ve isteğe bağlı dal notunu gösterir.
- Yeni dal, seçilen mesaja kadar olan mesajların bounded bir kopyasıyla oluşturulur.
  Parent conversation'ın `messages` dizisi değiştirilmez.
- Fork işlemi kendi başına hiçbir network isteği yapmaz. İlk API çağrısı, kullanıcı
  yeni dalda mesaj gönderdiğinde normal chat akışından gelir.
- Aktif dal için soy ağacı, üst sohbete dönüş, fork noktası, karşılaştırma ve yerel
  dal yedeği eylemleri bulunur.
- Sidebar'daki **Konuşma dalları** paneli mevcut sohbetin doğrudan çocuklarını
  listeler; **Tüm dallar** merkezi cihazdaki child dalları arayıp açar.
- `Ctrl / ⌘ + Shift + F`, düzenlenebilir bir alanın dışındayken son mesajdan fork
  akışını başlatır.

## Veri ve gizlilik

Fork verisi diğer sohbetlerle aynı yerde, `hafize.conversations.v1` altında ve yalnızca
cihazda tutulur. Fork için ayrı bir backend, telemetry veya credential alanı yoktur.
Metadata `forkOf`, `forkMessageId`, `forkDepth` ve `forkNote` alanlarıyla bounded
tutulur; bozuk veya bilinmeyen metadata app-shell normalize katmanında sınırlandırılır.

## Sınırlar

30 konuşma, parent başına 8 doğrudan dal, 4 dal derinliği ve fork başına 100 mesaj.
Limitler kullanıcı içeriğini silmek için değil, `localStorage` büyümesini ve parent
traversal maliyetini öngörülebilir tutmak için uygulanır.

## Erişilebilirlik

Onay penceresi `role="dialog"` ve `aria-modal` ile açılır, Tab odağını içeride tutar,
`Escape` ile kapanır ve odağı kendisini açan düğmeye geri verir. Dal listeleri
`aria-busy` ve `aria-live` durumlarını mevcut sohbet yüzeyiyle aynı biçimde kullanır.

## Ayrıntılı dokümanlar

| Dosya | İçerik |
|---|---|
| `CONVERSATION_FORKS_DATA_MODEL.md` | fork metadata alanları ve normalizasyon |
| `CONVERSATION_FORKS_LIMITS.md` | tüm bounded limitler ve gerekçeleri |
| `CONVERSATION_FORKS_PRIVACY.md` | yerel veri sınırları |
| `CONVERSATION_FORKS_SECURITY_REVIEW.md` | güvenlik incelemesi |
| `CONVERSATION_FORKS_THREAT_MODEL.md` | tehdit modeli |
| `CONVERSATION_FORKS_EVENTS.md` | yayınlanan DOM event'leri |
| `CONVERSATION_FORKS_USER_FLOWS.md` | kullanıcı akışları |
| `CONVERSATION_FORKS_USER_GUIDE.md` | kullanıcı rehberi |
| `CONVERSATION_FORKS_TESTING.md` | test kapsamı |
| `CONVERSATION_FORKS_QA_RUNBOOK.md` | manuel QA adımları |
| `CONVERSATION_FORKS_RECOVERY_FORMAT.md` | yerel yedek formatı |
| `CONVERSATION_FORKS_FAILURE_RECOVERY.md` | hata ve kurtarma davranışı |
| `CONVERSATION_FORKS_MIGRATION.md` | eski veriden geçiş |
| `CONVERSATION_FORKS_ROLLBACK.md`, `CONVERSATION_FORKS_ROLLBACK_CHECKLIST.md` | geri alma |
| `CONVERSATION_FORKS_RELEASE.md`, `CONVERSATION_FORKS_CHANGELOG.md` | sürüm kaydı |
| `CONVERSATION_FORKS_PERFORMANCE.md`, `CONVERSATION_FORKS_OBSERVABILITY.md` | performans ve gözlemlenebilirlik |
| `CONVERSATION_FORKS_BROWSER_MATRIX.md` | tarayıcı matrisi |
| `CONVERSATION_FORKS_ACCEPTANCE.md`, `CONVERSATION_FORKS_SCENARIOS.md`, `CONVERSATION_FORKS_EXAMPLES.md` | kabul kriterleri ve örnekler |
| `CONVERSATION_FORKS_DESIGN_REVIEW.md`, `CONVERSATION_FORKS_DEVELOPER.md`, `CONVERSATION_FORKS_SUPPORT.md` | tasarım, geliştirici ve destek notları |

## Kaynak dosyalar

- `public/typed/conversation-fork-core.ts` — fork hesaplama çekirdeği ve limitler
- `public/typed/conversation-forks.ts` — dialog, hub ve panel yüzeyi
- `public/conversation-forks.css` — yüzey stilleri
- `public/typed/app-shell.ts` — fork metadata normalizasyonu ve conversation açma
