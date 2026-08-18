# Toplu geçmiş temizleme — session-only geri alma sözleşmesi

## Amaç

İki-aşamalı `Temizle` eylemi başarıyla tamamlandıktan sonra kullanıcıya kısa süreli bir geri alma şansı verilir. Bu koruma yeni kalıcı veri deposu oluşturmaz.

## Davranış

- Silmeden hemen önce yalnız mevcut canonical `hafize.conversations.v1` snapshot'ı alınır.
- Snapshot `HafizeConversationStorageGuard.sanitizeStoredValue()` üzerinden geçmek zorundadır; unknown/secret benzeri gelecekteki alanlar undo belleğine taşınmaz.
- Silme gerçekten storage'ı exact `[]` durumuna getirdiyse `Temizle` düğmesi en fazla **12 saniye** `Geri al` olur.
- Kullanıcı geri alırsa canonical snapshot mevcut `localStorage.setItem` yoluna verilir ve uygulama yeniden yüklenir.
- `setItem` mevcut conflict-aware storage boundary'den geçtiği için başka sekmedeki yeni değişiklikleri körlemesine ezmez.
- Silme sonrasında storage başka bir sekme tarafından değiştirilmişse undo hiç arm edilmez.
- Timeout, Escape, sekmenin gizlenmesi veya controller destroy undo snapshot'ını RAM'den siler.

## Gizlilik ve güvenlik

Undo snapshot'ı yalnız JavaScript belleğinde yaşar; yeni local/session storage anahtarı, IndexedDB, cookie veya backend kaydı oluşturulmaz. Snapshot yalnız conversation guard'ın canonical allowlist alanlarını içerebilir.

Undo katmanı network isteği, tool çağrısı, dış servis write/send/merge işlemi veya agent permission üretmez. Dört profilli roster ve backend default-deny sözleşmesi değişmez.

## Fail-closed koşulları

Aşağıdakilerden biri yoksa undo sunulmaz:

- `HafizeConversationStorageGuard`,
- canonical sanitizer,
- mevcut conversation storage,
- `location.reload()`.

Restore yazımı başarısız olursa sayfa reload edilmez ve kullanıcıya sahte başarı gösterilmez.

## Geri alma

Bu PR geri alınırsa yalnız 12 saniyelik undo lifecycle ve testi kaldırılır; alttaki iki-aşamalı toplu temizleme intent'i korunabilir.