# Akıllı Görünümler Release ve Rollback

## Release checklist

- [ ] Smart Views JS syntax kontrol edildi.
- [ ] Builder JS syntax kontrol edildi.
- [ ] History JS syntax kontrol edildi.
- [ ] CSS asset'leri index.html'e eklendi.
- [ ] Service worker cache sürümü artırıldı.
- [ ] Query operator testleri geçti.
- [ ] Limit testleri geçti.
- [ ] Storage recovery testleri geçti.
- [ ] Accessibility testleri geçti.
- [ ] Import/export testleri geçti.
- [ ] README güncellendi.

## Smoke

Yeni istem oluştur.
En az bir tag ekle.
İstemi favorile.
Birden fazla kullanım sayısını doğrula.
Akıllı görünüm oluştur.
tag ve used operatörlerini birlikte çalıştır.
Görünümü uygula.
Geçmişte tekrar gör.
Export/import ile geri yükle.

## Rollback

Önce PR revert edilir.
Prompt Library ana storage alanı değiştirilmediği için temel istem kayıtları korunur.
Smart Views storage anahtarları isteğe bağlı olarak temizlenebilir.
Service worker eski shell cache'ine döndürülür.

## Başarısızlık stratejisi

Storage yazma başarısızsa mevcut kayıt değişmemelidir.
Import parse başarısızsa mevcut görünüm listesi değişmemelidir.
Geçersiz görünüm id'leri normalize edilir.
Kapasite aşımında en eski/sonraki kayıtlar sessizce silinmek yerine import sonucu raporlanmalıdır.

## Compatibility

Chrome/Edge/Firefox/Safari modern browser davranışı hedeflenir.
PWA kurulu sürüm eski asset ile açılabiliyorsa cache version update mekanizması eski shell'i temizlemelidir.
Smart Views olmadan Prompt Library temel akışları çalışmaya devam etmelidir.