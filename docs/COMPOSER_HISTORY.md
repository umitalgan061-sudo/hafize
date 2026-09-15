# Composer History

Composer History, sohbette gönderilmiş kullanıcı metinlerini cihaz üzerinde tekrar çağırmak için kullanılan yerel yardımcı yüzeydir.

## Kapsam

Geçmiş yalnız `#messageInput` composer'ından yapılan başarılı submit akışlarında yeni kayıt üretir.

Kayıtlar basit UTF-8 metin dizileri olarak tutulur.

Varsayılan üst sınır 40 kayıttır.

Her kayıt 12.000 karakterle sınırlıdır.

Aynı metin tekrar gönderildiğinde yeni kopya eklenmez; kayıt en üste taşınır.

## Kullanım

`↑` ve `↓` yalnız imleç metnin başında veya sonunda iken geçmişte gezinir.

IME composition sırasında bu kısayollar yakalanmaz.

Geçmişten bir kayıt seçildiğinde yalnız composer değeri değiştirilir.

Mesaj otomatik gönderilmez.

Panel `Ctrl/⌘ + Shift + H` ile açılıp kapanır.

Escape açık paneli kapatır.

## Gizlilik

Veri backend'e, analytics'e veya telemetry'ye gönderilmez.

Storage anahtarı `hafize.composer-history.v1`'dir.

Ayarlar `hafize.composer-history.settings.v1` altında ayrı tutulur.

Kullanıcı geçmiş kaydını tamamen kapatabilir veya 10/20/40 kayıt sınırı seçebilir.

Kapalı modda yeni kayıt yazılmaz ve mevcut history storage temizlenir.

## Yedekleme

JSON export yalnız mevcut cihazdaki kayıtları içerir.

Import bounded ve normalize edilir.

Import mevcut kayıtlarla deduplicate edilir.

Import edilen verinin otomatik gönderimi yoktur.

## PWA

Composer history JavaScript/CSS varlıkları shell cache'e alınır.

API yolları shell cache'e girmez.

## Geri alma

Üst katman dosyaları revert edildiğinde mevcut chat composer davranışı korunur.

Yerel eski storage kayıtları kritik bir backend veri kaynağı değildir.
