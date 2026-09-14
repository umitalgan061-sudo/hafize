# Smart Fill Tasarım İncelemesi

## Karar

Smart Fill ayrı bir UI katmanı olarak tutulur; Prompt Library çekirdeğinin değişken normalizasyonunu tekrar etmez.

## Neden ayrı dosya

- Prompt Library çekirdeği veri CRUD'undan sorumludur.
- Smart Fill form davranışından sorumludur.
- Command palette composer keşfinden sorumludur.
- Service worker yalnız asset politikasıyla ilgilenir.

Bu ayrım bir özelliğin silinmesi veya rollback edilmesi sırasında ana sohbet akışını daha az etkiler.

## Event stratejisi

Değişkenli `Kullan` olayı capture phase'de yakalanır. Böylece iki farklı davranışın aynı anda composer'a yazması engellenir. Değişkensiz kayıtlar mevcut handler'a bırakılır.

## Veri stratejisi

Prompt kayıtları tek ana storage anahtarında, presetler prompt-id tabanlı ayrı anahtarlarda tutulur. Preset değerleri Prompt Library export'una dahil edilmez.

## UX kararı

Kullanıcıya son metni göstermeden composer'a aktarmamak hedeflenir. Özellikle müşteri adı, tarih, dosya yolu gibi değişkenlerde görünür önizleme yanlış gönderim riskini azaltır.

## Command palette kararı

Global arama yerine yalnız cihazdaki prompt kayıtları taranır. Sonuçlar 12 ile sınırlıdır. Başlık eşleşmesi gövdeden daha yüksek önceliktedir.

## Non-goals

- remote prompt sync,
- ekip paylaşımı,
- şifreli preset vault,
- server-side telemetry,
- otomatik prompt gönderimi.

## İnceleme sonucu

Özellik mevcut Prompt Library sınırlarıyla uyumlu, ağ bağımsız ve geri alınabilir durumdadır.
