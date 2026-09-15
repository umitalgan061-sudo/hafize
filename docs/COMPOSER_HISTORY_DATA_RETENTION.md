# Composer History — Saklama Yaşam Döngüsü

## Capture

Submit sırasında metin alınır.

Boş metin atlanır.

Metin null byte ve karakter sınırından geçirilir.

## Retention

Kayıt en üst sıraya alınır.

Aynı string mevcutsa duplicate kaldırılır.

Limit aşıldığında en eski kayıtlar düşer.

## Opt-out

`enabled:false` history storage'ını temizler.

`maxItems:0` de aynı sonucu üretir.

Opt-out sonrası controller history listesi boş olur.

## Re-enable

Kullanıcı tekrar açtığında yalnız yeni submitler kaydedilir.

Önceden temizlenen kayıtlar otomatik geri gelmez.

## Manual clear

Clear kullanıcı confirmation sonrası yapılır.

Clear mevcut draft metnini değiştirmez.

## Backup lifecycle

Export snapshot anında alınır.

Export daha sonra yeni submitlerle güncellenmez.

Import mevcut kayıtlarla merge edilir.

## Browser lifecycle

Reload sonrasında enabled history varsa yüklenir.

Storage temizlenirse history kaybolur.

Private browsing politikaları nedeniyle persistence olmayabilir.

## Data minimization

Her kayıt düz metindir.

Ek timestamp veya account id tutulmaz.

## Test

Retention testleri capture, trim, disable, re-enable ve clear akışlarını doğrulamalıdır.
