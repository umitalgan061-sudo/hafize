# Platform Runtime Release

## Pre-release

- `main` base commit'i güncel.
- `npm run typecheck` tamamlandı.
- `npm run build` tamamlandı.
- Source contract testleri tamamlandı.
- Browser smoke testi tamamlandı.
- PWA offline testi tamamlandı.

## Functional

- Platform status button tekil.
- Dashboard aç/kapat çalışıyor.
- Escape davranışı çalışıyor.
- Online/offline değişimleri doğru gösteriliyor.
- Capability fallback'leri crash üretmiyor.
- Diagnostics export kullanıcı tarafından başlatılıyor.
- Task queue timeout ve cancel davranışı çalışıyor.

## Security

- Diagnostics chat içermez.
- Credentials ve cookie içermez.
- Error boundary redaction çalışıyor.
- Yeni permission request eklenmemiş.
- API cache dışı.

## Accessibility

- Dialog label mevcut.
- Açılır panel focus alıyor.
- Escape ile kapanıyor.
- Reduced motion desteği mevcut.
- Forced colors desteği mevcut.
- Canlı durum metinleri kısa tutuluyor.

## Performance

- Dashboard kapalıyken repaint yapılmıyor.
- Metrics bounded.
- Errors bounded.
- Queue bounded.
- Storage estimate best-effort.
- Unsupported observer type bütün boot'u durdurmuyor.

## PWA

- Typed app runtime shell'de.
- Static HTML navigation offline fallback ile uyumlu.
- API requests network-only.
- Cache version değişikliği kontrollü.

## Rollback

1. Platform entry eski typed app entry'sine alınır.
2. Service worker cache version güvenli sürüme döner.
3. Runtime metadata silinmez.
4. Browser smoke testi tekrar yapılır.

## Release notu

Kullanıcıya sunulacak değişiklik, platform yeteneklerini cihaz üzerinde görünür hale getirir; üçüncü taraf analytics eklemez.
