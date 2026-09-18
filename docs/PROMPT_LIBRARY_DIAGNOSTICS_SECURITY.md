# Diagnostics security review

## Input
Diagnostics storage'dan okuduğu alanları normalize eder ve DOM'a raw HTML basmaz.

## Mutasyon
Repair fonksiyonları bounded normalizer çıktıları üzerinden çalışır.

## Duplicate safety
Duplicate prompt ID'leri drop edilmez; yeni ID ile korunur.

## Cross-store safety
Collections ve revisions yalnızca mevcut prompt ID'leriyle ilişki kurar.

## Destructive action
Geçersiz kayıt silme ayrı buton ve confirmation ile korunur.

## Network
Diagnostics için hiçbir remote transport kullanılmaz.
