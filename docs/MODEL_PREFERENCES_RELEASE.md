# Model ve Ajan Tercihleri Release Checklist

## Kod

- Typed state helper eklendi.
- Typed UI panel eklendi.
- App shell entegrasyonu yapıldı.
- CSS responsive ve forced-colors kuralları eklendi.
- PWA cache sürümü artırıldı.
- Model ve ajan seçimi mevcut chat akışını koruyor.

## Veri

- Dedicated localStorage key kullanılıyor.
- Altı profil sınırı uygulanıyor.
- Import/export sınırları uygulanıyor.
- ID çakışmaları overwrite yapmıyor.
- Bozuk storage güvenli default'a dönüyor.

## UX

- Tercihler paneli composer'a yakın.
- Current selection gösteriliyor.
- Uygula ve Sil aksiyonları görünür.
- Reset onaylı.
- Escape ve Ctrl/⌘+Shift+M destekleniyor.
- Focus restore mevcut.

## Güvenlik

- Yeni backend endpoint yok.
- Secret saklama alanı yok.
- Yeni telemetry yok.
- Export URL revoke ediliyor.
- Profil uygulama submit yapmıyor.

## PWA

- model-preferences.css shell asset.
- Cache version v45.
- API istekleri network-only kalır.

## DoD

- Typed unit test.
- Source contract test.
- Security test.
- Accessibility test.
- PWA test.
- Lifecycle test.
- Import/export test.

## Rollback

PR revert edilebilir.
Local preference key kalabilir.
Gerekirse kullanıcıya hafize.model-preferences.v1 temizliği açıkça yaptırılır.
