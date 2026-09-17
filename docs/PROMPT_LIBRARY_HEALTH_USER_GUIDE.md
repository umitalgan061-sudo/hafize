# Kütüphane Kalite Merkezi Kullanıcı Rehberi

## Açma

İstem Kütüphanesi içindeki `Kütüphane kalite merkezi` başlığını kullan.

Panel ilk açıldığında cihazındaki prompt kayıtlarını tarar.

## Durumu okuma

Yeşil veya sağlıklı mesaj hata olmadığını belirtir.

Hata ve uyarı sayıları sorunların türünü hızlıca anlamaya yarar.

Bilgi bulguları veri kaybı anlamına gelmez; genellikle kullanılmayan, eski veya benzer kayıtları gösterir.

## Filtreleme

`Tümü` tüm bulguları gösterir.

`Hatalar` yapısal sorunları gösterir.

`Uyarılar` bakım sorunlarını gösterir.

`Bilgi` gözden geçirilebilecek önerileri gösterir.

## Onarım

Önce mevcut istemleri JSON olarak dışa aktarmak isteyebilirsin.

Sonra `Güvenli onarım` düğmesine bas.

Tarayıcı onay istediğinde kabul edersen sistem mevcut normalizer ile kayıtları temiz biçime getirir.

## Rapor

`Raporu kopyala` hızlı paylaşım veya destek analizi için JSON özetini panoya verir.

Health enhancement etkinse `Raporu indir` tam bounded raporu dosyaya kaydeder.

## Sorunlu promptlar

`Sorunlu promptları indir` yalnızca hata veya uyarı ile ilişkili prompt kayıtlarını dışa aktarır.

Bu işlem sunucuya veri göndermez.

## Ne zaman kullanmalı?

Büyük import sonrasında, collection üyelerinde değişiklik yaptığında veya kütüphane büyüdüğünde tekrar tarama faydalıdır.

## Güvenli kullanım

Tanı paneli otomatik olarak prompt silmez. Kullanıcı onayı gerektiren onarım dışında yazma işlemi yapmaz.
