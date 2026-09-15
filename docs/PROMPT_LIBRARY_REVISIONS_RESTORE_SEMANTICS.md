# Restore Semantics

## Identity

Restore edilmiş revision mevcut prompt'un id'si ile uygulanır. Yeni prompt oluşturulmaz.

## Content

Başlık, body ve tags seçilen revision'dan alınır ve core normalize işleminden geçirilir.

## Preserved metadata

Favorite, useCount ve createdAt mevcut prompt'tan korunur.

## Updated metadata

updatedAt restore anında yeni timestamp ile güncellenir.

## Safety snapshot

Restore'dan önce active prompt manual revision olarak capture edilir. Bu, restore işlemini fiilen geri alınabilir hale getirir.

## Confirmation

Kullanıcı onay vermeden restore işlemi başlatılmaz.

## Missing target

Prompt silinmişse restore hiçbir yazma işlemi yapmadan failure döndürür.

## Invalid revision

Boş body veya geçersiz promptId restore edilemez.

## Cross-prompt protection

Revision promptId ile hedef prompt aynı değilse revision başka bir kayda uygulanamaz.

## Storage failure

Ana prompt kaydedilemiyorsa restore false sonucu üretir ve UI hata mesajı verebilir.

## Refresh

Başarılı restore sonrası core storage event ile yenilenir. Prompt listesi yeni içerikle tekrar render edilir.

## Usage integrity

Restore kullanım sayacını değiştirmez. Kullanım istatistikleri geçmiş sürüm geri alındığında bile gerçek toplamı korur.

## Favorite integrity

Restore favori state'i değiştirmez. Kullanıcı daha sonra favoriyi ayrı bir işlem olarak değiştirebilir.

## Rollback chain

Manual snapshot sayesinde A → B → A gibi geri dönüşlerde son durumlar history zincirinde korunur.
