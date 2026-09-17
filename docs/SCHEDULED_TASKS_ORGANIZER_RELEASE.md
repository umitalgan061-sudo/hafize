# Organizer — Release Checklist

## Source

Organizer, actions ve dashboard dosyaları branch üzerinde bulunmalı.

Index asset sırası core → enhancement → organizer/actions/dashboard → keyboard şeklinde olmalı.

Service worker shell asset listesi yeni CSS/JS dosyalarını içermeli.

Cache version yeni sürüme çıkarılmalı.

## Behavior

Arama çalışmalı.

Ajan filtresi çalışmalı.

Sıralama çalışmalı.

Zaman penceresi çalışmalı.

Görünüm preset'i kaydedilip uygulanabilmeli.

Toplu seçim yalnızca planlı görevlerde etkin olmalı.

Toplu iptal onay istemeli.

Export yalnızca görünür görevleri içermeli.

Detail dialog Escape ile kapanmalı.

Duplicate yalnızca kullanıcı onayından sonra POST yapmalı.

## Security

Task payload localStorage'a yazılmamalı.

Token veya cookie okunmamalı.

Dynamic task content HTML olarak enjekte edilmemeli.

API path ID encoding korunmalı.

Export otomatik çalışmamalı.

## Accessibility

Tüm organizer kontrolleri accessible label taşımalı.

Live status alanları yalnızca renk kullanmamalı.

Checkbox disabled durumu ekran okuyucuya iletilmeli.

Detail dialog başlık ilişkisi bulunmalı.

Mobile düzen Tab ile kullanılabilmeli.

## PWA

Organizer asset'leri shell cache'te bulunmalı.

Schedule API response'ları cache'te bulunmamalı.

Offline shell organizer kodu eksik dosya nedeniyle parse hatasına düşmemeli.

## Testing

Organizer contract test.

Storage test.

Duplicate test.

UI test.

Security test.

PWA test.

Dashboard test.

Actions test.

DOM safety test.

Lifecycle test.

Time filter test.

Regression test.

## Sign-off

Diff 3000 altında olmalı.

Çalıştırılmayan testler PR notunda açıkça belirtilmeli.

Rollback yolu belgelenmeli.
