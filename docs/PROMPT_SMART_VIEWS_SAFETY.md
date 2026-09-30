# Akıllı Görünümler Güvenliği ve Onarım

Akıllı Görünümler Sağlığı paneli, yalnız görünüm storage alanını inceler.

## Tarama

Tarama JSON okunabilirliğini, kayıt kapasitesini, boş adları, aşırı uzun sorguları, kullanım aralığı hatalarını, geçersiz sıralamaları, duplicate id ve duplicate ad durumlarını raporlar.

## Güvenli onarım

Onarım başlamadan önce checkpoint oluşturulur.
Checkpoint yazılamazsa görünüm verisi değiştirilmez.
Normalize edilemeyen kayıtlar atlanır.
Duplicate id değerleri yeni yerel id ile ayrıştırılır.
Duplicate ad değerleri deterministik suffix ile ayrıştırılır.
24 kayıt kapasitesi korunur.

## Geri alma

Son onarım checkpoint'i saklanır.
“Son onarımı geri al” checkpoint içindeki ham görünüm listesini geri yükler.
Geri alma başarılı olunca checkpoint temizlenir.
Core Prompt Library kayıtları bu işlemden etkilenmez.

## Yedek

Recovery JSON yalnız görünüm kayıtlarını içerir.
300 KB üzerindeki checkpoint/yedek üretilmez.
Dosya indirme tarayıcı tarafında yapılır.

## Güvenlik sınırları

Network isteği yoktur.
Credential erişimi yoktur.
Prompt body sağlık onarımına kopyalanmaz.
Yalnız JSON normalization ve local storage kullanılır.

## Failure policy

Storage okunamıyorsa repair disabled olur.
Write başarısızsa mevcut görünüm listesi korunmaya çalışılır.
Import veya repair sırasında servis çağrısı tetiklenmez.
Kullanıcı onayı olmadan destructive repair çalıştırılmaz.