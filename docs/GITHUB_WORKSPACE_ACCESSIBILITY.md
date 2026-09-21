# GitHub çalışma alanı accessibility

## Semantik

Ana kart section ve aria-labelledby kullanır. Durum metinleri aria-live ile duyurulur. Görünüm düğmeleri aria-pressed durumunu bildirir.

## Form alanları

Repository, ref, path, commit SHA ve PR numarası alanları explicit aria-label taşır.

## Klavye

Ctrl / Cmd + Shift + G repository alanına odaklanır. Branch satırları Enter ve Space ile seçilebilir.

## Odak

Focus-visible outline kullanılır. Modal olmayan sonuç listelerinde görünür focus kaybolmaz. External linkler yeni bağlamda açıldığında noopener noreferrer kullanır.

## Renk

Forced-colors CSS kuralları sonuç ve input border'larını görünür tutar. Bilgi yalnız renk ile aktarılmaz.

## Mobil

700px altında kontroller tek kolon veya grid yapısına geçer. Sonuç alanları sınırlı scroll alanında kalır.

## Az hareket

Reduced motion ortamında workspace ek animasyon üretmez.

## Uzak içerik

Commit message, PR body ve dosya içeriği textContent veya pre text olarak gösterilir; HTML yorumlanmaz.

## Test

Accessibility kaynak testleri aria, focus, keyboard, forced-colors ve innerHTML yasağını kontrol eder.
