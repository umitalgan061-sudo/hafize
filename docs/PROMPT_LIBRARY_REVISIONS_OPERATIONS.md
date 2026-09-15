# Revision History Operations

## Operasyon amacı

Bu modül kullanıcı cihazındaki Prompt Library revision kayıtlarını güvenli, bounded ve geri alınabilir bir arayüz olarak tutar.

## Başlangıç kontrolü

Release öncesi `public/prompt-library-revisions.js` dosyasının PWA shell asset listesinde bulunduğu doğrulanır. `hafize.prompt-library.revisions.v1` anahtarının Prompt Library anahtarından farklı olduğu kontrol edilir.

## Normal çalışma

Revision oluşturma, düzenleme tıklamasının capture aşamasında gerçekleşir. Bu nedenle editor açıldığında eski içerik zaten kayıt altındadır.

## Retention

Prompt başına 10 revision tutulur. Daha yeni kayıt eklendiğinde en eski kayıt retention penceresinden çıkar.

## Storage sorunları

Quota veya storage erişim hatasında `readAll()` boş store ile devam eder; `writeAll()` false döndürür. Ana Prompt Library restore işleminin başarısızlığı kullanıcıya açık status mesajı olarak yansıtılır.

## Temizleme

Tek prompt history temizleme komutu yalnız revision anahtarındaki ilgili prompt id'sini siler. Prompt Library kaydı korunur.

## Export operasyonu

Export çıktısı 1 MB ile sınırlandırılır. Aşırı boyut halinde en son 5 revision alınır. Dosya adı sabit tutulur.

## Support doğrulama

Destek ekibi sorun yaşayan kullanıcıdan revision JSON içeriğini isteyebilir; ancak dosya içindeki prompt metinlerinin hassas olabileceği belirtilmelidir.

## PWA

Yeni revision kodu değiştiğinde shell cache sürümü artırılır. Eski cache adları service worker politikasında temizlenmeye devam eder.

## Geri alma

Feature rollback için revision scriptinin uygulamadan çıkarılması yeterli olabilir. Önceden yazılmış local storage anahtarı otomatik silinmemelidir; böylece daha sonra uyumlu sürümde veri kurtarılabilir.

## Gözlem

Sunucu loglarında revision olayı bulunmaz. Bu bilinçli tasarımdır; revision usage telemetrisi eklenmez.
