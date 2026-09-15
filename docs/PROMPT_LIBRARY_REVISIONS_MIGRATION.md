# Revision History Migration

## İlk kurulum

Revision storage anahtarı ilk kullanımda otomatik oluşturulabilir; boş değer için kullanıcı işlemi gerekmez.

## Mevcut Prompt Library

Ana prompt storage'ı değişmeden kalır. Revision module mevcut kayıtları geriye dönük olarak dönüştürmeye çalışmaz; yalnız düzenleme öncesi snapshot üretir.

## Eski revision sürümleri

`version` alanı yalnız export payload'ında bulunur. Storage schema doğrudan object map olarak tutulur. Yeni format eklenirse parser eski sürümü normalize ederek dönüştürmelidir.

## Import

Bu tur revision export'u bağımsız backup olarak tasarlanmıştır. Ana Prompt Library import akışına otomatik olarak karıştırılmaz.

## Cihaz taşıma

Kullanıcı history export alır, yeni cihazda desteklenen migration mekanizması üzerinden kullanır. Raw localStorage kopyalama desteklenen bir kullanıcı akışı değildir.

## Veri kaybı önleme

Migration başarısız olduğunda mevcut revision storage üzerine boş veri yazılmaz. Parser yalnız doğrulayabildiği kayıtları kabul eder.

## Rollback uyumu

UI sürümü geri alınsa bile revision anahtarı korunur. İleride aynı schema ile çalışan sürüm geçmişi yeniden görüntüleyebilir.

## Depolama sınırları

Migration hiçbir durumda 120 prompt veya prompt başına 10 revision sınırını aşmamalıdır.

## Güvenlik

Migration metni HTML'e çevrilmez. Import edilen kayıtlar normalize edilmeden DOM'a verilmez.
