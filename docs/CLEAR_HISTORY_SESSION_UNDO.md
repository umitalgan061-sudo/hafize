# Toplu geçmiş temizleme — session-only geri alma sözleşmesi

## Amaç

İki-aşamalı `Temizle` eylemi başarıyla tamamlandıktan sonra kullanıcıya kısa süreli bir geri alma şansı verilir. Bu koruma yeni kalıcı veri deposu oluşturmaz ve geri alınan sohbetin güvenli yerel UI bağlamını da korur.

## Davranış

- Silmeden hemen önce canonical `hafize.conversations.v1` snapshot'ı alınır.
- Canonical snapshot `HafizeConversationStorageGuard.sanitizeStoredValue()` üzerinden geçmek zorundadır; unknown/secret benzeri gelecekteki alanlar undo belleğine taşınmaz.
- Yüklüyse üç bounded companion katman da kendi mevcut şema doğrulayıcılarıyla RAM snapshot'ına alınır: `hafize.conversation-organize.v1`, `hafize.conversation-models.v1` ve `hafize.conversation-branches.v1`.
- Companion snapshot yalnız pin/özel başlık, `{conversationId, modelId}` tercihi ve bounded branch-lineage kimlik alanlarını içerir. Mesaj metni, token, credential, owner/trace kimliği veya connector verisi companion snapshot'a alınmaz.
- Her companion raw read en fazla **96 KiB** ile sınırlıdır; lineage ayrıca kendi 64 KiB storage limitini korur. İlgili modül yoksa veya veri sınırı/şeması geçersizse o companion katman sessizce undo kapsamı dışında kalır.
- Silme gerçekten canonical storage'ı exact `[]` durumuna getirdiyse `Temizle` düğmesi en fazla **12 saniye** `Geri al` olur.
- Kullanıcı geri alırsa canonical snapshot mevcut `localStorage.setItem` yoluna verilir ve storage guard'ın conflict-aware uzlaştırması korunur.
- Canonical restore sonrasında companion metadata, geri dönen canonical sohbet kümesine karşı yeniden doğrulanır. Mevcut/remote companion kayıtları önce gelir; snapshot yalnız eksik eski kayıtları tamamlar. Böylece başka sekmenin daha yeni pin, başlık veya model tercihi körlemesine ezilmez.
- Branch lineage restore'u final canonical konuşma ve source-message indeksine karşı yeniden doğrulanır; stale/cyclic/invalid ilişki geri getirilemez.
- Companion restore best-effort'tur: bir metadata katmanının yazımı başarısız olsa bile başarılı canonical sohbet restore'u geri çevrilmez.
- Timeout, Escape, sekmenin gizlenmesi veya controller destroy undo snapshot'ını RAM'den siler.

## Neden companion state gerekli?

Toplu temizlemeden sonra conversation listesi boşaldığında organizer ve lineage gibi aynı-sekme gözlemcileri stale metadata'yı doğru biçimde prune edebilir. Eski undo yalnız transcript'i geri getirdiğinden kullanıcı 12 saniye içinde `Geri al` dese bile pin/özel başlık veya branch kaynak ilişkileri kaybolabiliyordu. Companion snapshot bu pencereyi gerçek bir kullanıcı-seviyesi geri alma davranışına dönüştürür; kalıcı yeni bir undo deposu oluşturmaz.

## Gizlilik ve güvenlik

Undo snapshot'ı yalnız JavaScript belleğinde yaşar; yeni local/session storage anahtarı, IndexedDB, cookie veya backend kaydı oluşturulmaz. Canonical transcript yalnız conversation guard allowlist'inden, companion state ise ilgili modüllerin bounded normalizer/parser çıktılarından oluşabilir.

Undo katmanı network isteği, tool çağrısı, dış servis write/send/merge işlemi veya agent permission üretmez. Dört profilli roster ve backend default-deny sözleşmesi değişmez.

## Fail-closed koşulları

Aşağıdakilerden biri yoksa canonical undo sunulmaz:

- `HafizeConversationStorageGuard`,
- canonical sanitizer,
- mevcut conversation storage,
- `location.reload()`.

Bir companion modülü mevcut değilse veya companion raw state sınırı aşıyorsa yalnız o metadata snapshot'ı atlanır. Restore yazımı başarısız olursa canonical başarı companion başarıymış gibi yorumlanmaz; sayfa yalnız canonical sohbet restore'u doğrulandıktan sonra reload edilir.

## Geri alma

Bu değişiklik geri alınırsa companion snapshot/merge katmanı ve ilgili regresyon testi kaldırılır; alttaki iki-aşamalı toplu temizleme intent'i ile 12 saniyelik canonical undo korunabilir.
