# Composer Ekleri — Review Guide

## Kod incelemesi

1. Policy limitleri tek kaynaktan okunuyor mu?
2. Runtime read öncesi validation yapıyor mu?
3. Risk scanner sonuçları yalnız label olarak gösteriliyor mu?
4. Insert atomic mi?
5. Cursor ve selection korunuyor mu?
6. Undo güvenli koşul arıyor mu?
7. Destroy tüm üst seviye listenerları kaldırıyor mu?
8. Kullanıcı content storage'a yazılıyor mu?
9. Network sink oluşmuş mu?
10. Submit yolu oluşmuş mu?

## UX incelemesi
Panel görünür, anlaşılır ve keyboard erişilebilir olmalıdır. Range, preview, copy ve quick actions birbiriyle tutarlı çalışmalıdır.

## Security review
Riskli content kullanıcı confirm olmadan composer'a girmemelidir.

## Release
PWA asset wiring ve cache version kontrol edilmeden feature tamamlanmış sayılmaz.