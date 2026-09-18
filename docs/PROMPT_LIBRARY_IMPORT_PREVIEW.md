# Prompt Library import önizlemesi

## Amaç
Prompt Library JSON içe aktarımı artık yazma işleminden önce dosyanın içeriğini analiz eder.

## Akış
1. Dosya boyutu kontrol edilir.
2. JSON parse edilir.
3. Prompt Library normalizer'ı ile uygun kayıtlar ayrıştırılır.
4. ID çakışmaları ve kapasite etkisi hesaplanır.
5. İlk kayıtlar önizleme olarak gösterilir.
6. Kullanıcı onay verirse güncel storage yeniden okunur.
7. Birleştirme tekrar yapılır ve sonuç kaydedilir.

## Değişmezler
Önizleme aşaması storage'a yazmaz. İptal dosya input değerini temizler. Otomatik submit veya sunucu çağrısı yoktur.

## Sınırlar
Dosya 1 MB ile, çalışma koleksiyonu 120 prompt ile sınırlıdır. Önizleme sınırlı sayıda kayıt gösterir; dosyanın tamamı yalnızca onay sonrası işlenir.

## Çatışmalar
Aynı id birden fazla kez gelirse mevcut kayıt korunur, yeni gelen kayıt güvenli yeni id ile eklenir.

## Hata davranışı
Geçersiz JSON, okunamayan dosya ve storage yazma hatası kullanıcıya açıklanır. Mevcut kayıtlar hata anında silinmez.

## DoD
Önizleme, onay, iptal, limit ve PWA testleri geçmeden özellik tamamlanmış sayılmaz.
