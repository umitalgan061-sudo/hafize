# GitHub çalışma alanı release review

## İşlevsel kontrol

Repository özeti okunuyor mu: evet.
Branch listesi okunuyor mu: evet.
Commit listesi okunuyor mu: evet.
PR listesi durum filtresiyle okunuyor mu: evet.
Dosya içeriği güvenli read policy ile okunuyor mu: evet.
Dizin listesi okunuyor mu: evet.
İki ref karşılaştırılabiliyor mu: evet.
Commit ve PR ayrıntısı okunabiliyor mu: evet.

## Güvenlik kontrolü

Repository allowlist backend'de uygulanıyor.
GitHub token browser bundle'ına girmiyor.
Workspace method'ları GET ile sınırlı.
Hassas dosya ve credential içeriği mevcut read policy tarafından korunuyor.
Uzak metin HTML olarak çalıştırılmıyor.
API yanıtları service worker shell cache'e yazılmıyor.

## UX kontrolü

Kısayol görünür.
Durum mesajları aria-live ile duyuruluyor.
Branch satırları klavye ile seçilebiliyor.
Mobil ve forced-colors stilleri mevcut.
Recent repository geçmişi session sınırında tutuluyor.
Kopyalama ve yenileme başarısız olduğunda kullanıcıya bildirim veriliyor.

## Operasyon kontrolü

Rate-limit mevcut API boundary'den uygulanıyor.
Workspace kendi retry loop'unu çalıştırmıyor.
Upstream hata body'leri kullanıcıya ham biçimde taşınmıyor.
Rollback diğer workspace storage'larına dokunmuyor.

## Test kontrolü

Vitest reader testleri mevcut.
Static route, security, UI, PWA, bounds, cache ve detail testleri mevcut.
Tam repo smoke bu çalışma ortamında checkout DNS'i nedeniyle gerçekleştirilemiyorsa PR notuna yazılmalıdır.

## Kabul ölçütü

Bu dokümandaki işlevsel, güvenlik, UX, operasyon ve test maddeleri aynı release'te karşılanmadan GitHub workspace tamamlanmış kabul edilmez.
