# Smart Insert — Release Checklist

## Kod

- Smart Insert ana modülü browser-only çalışır.
- Profil merkezi ayrı storage anahtarlarını kullanır.
- Geçmiş raw prompt body ve değişken değerleri saklamaz.
- Profil preset katmanı değişken adlarını bounded biçimde normalize eder.
- Validation katmanı body, variable name ve value limitlerini uygular.
- Dynamic DOM üretiminde kullanıcı metni textContent/value ile yazılır.

## UI

- Değişkenli istemlerde Akıllı doldur butonu görünür.
- Değişkensiz istemlerde doğrudan composer aktarımı korunur.
- Modal açıldığında ilk alan odaklanır.
- Kapat düğmesi, Escape ve backdrop kapatma çalışır.
- Tab odak döngüsü modal sınırlarında kalır.
- Composer aktarımı input event'i yayınlar.
- Otomatik submit veya requestSubmit çağrısı yoktur.

## Profiller

- 24 profil sınırı korunur.
- Profil adı 60 karakter sınırındadır.
- Değişken sayısı 12 ile sınırlıdır.
- Tek değişken değeri 1000 karakteri geçmez.
- Duplicate profil kimliği üretir.
- Rename duplicate isimleri reddeder.
- Favorite güncellemesi updatedAt'i yeniler.
- Import aynı isimde mevcut profil ile merge eder.
- Import yeni kayıtları kapasite dolana kadar ekler.
- Export sürüm ve kaynak alanı içerir.

## Geçmiş

- En fazla 40 kayıt tutulur.
- Aynı prompt tekrar kullanıldığında önceki kayıt tekilleştirilir.
- History yalnızca promptId, label, usedAt ve reason taşır.
- Tek kayıt kaldırma Prompt Library kaydını etkilemez.
- Tüm geçmişi temizleme onay gerektirir.

## Öneriler ve ön ayarlar

- Profil değişkenleri ile prompt variables eşleştiğinde skor yükselir.
- En fazla 5 öneri gösterilir.
- Eksik değerler açıkça işaretlenir.
- Preset isimleri bounded ve unique'tir.
- Preset import/export local-only'dir.

## PWA

- Smart Insert JS/CSS dosyaları shell cache listesinde bulunur.
- Cache versiyonu yeni asset seti ile birlikte artırılır.
- `/api/` istekleri network-only kalır.

## Test

- Source contract testi çalışır.
- Profile testi çalışır.
- History privacy testi çalışır.
- Integration testi çalışır.
- Validation testi çalışır.
- Syntax checker tüm public JavaScript dosyalarını tarar.

## Rollback

- Smart Insert loader bağı kaldırılabilir.
- Asset cache listesi önceki sürüme döndürülebilir.
- Prompt Library core kayıtları korunur.
- Profil, preset ve history storage anahtarları bağımsızdır.
