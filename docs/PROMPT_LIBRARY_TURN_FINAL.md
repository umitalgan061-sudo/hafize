# Prompt Library turn final notu

Bu turda Prompt Library için üç kullanıcı odaklı güvenlik/ergonomi katmanı hazırlanmıştır: içe aktarma önizlemesi, kütüphane sağlık tanısı ve toplu düzenleyici.

İçe aktarma preview, JSON içeriğini storage'a yazmadan önce dosya boyutunu, kayıt sayısını, id çakışmalarını ve kapasiteyi gösterir. Yazma yalnız açık kullanıcı onayından sonra yapılır.

Sağlık tanısı, yerel prompt ve collection storage alanlarını bounded biçimde inceler. Bozuk prompt, tekrarlı id ve artık olmayan prompt id'sine sahip collection üyeleri raporlanır. Onarım confirm sonrasında çalışır.

Toplu düzenleyici 40 seçime kadar prompt üzerinde etiket ekleme, değiştirme, çıkarma ve favori durumu işlemlerini uygular. Tüm yazımlar mevcut normalizer üzerinden geçer.

Yeni yüzeyler backend endpoint, analytics veya telemetry eklemez. Kullanıcı metni DOM'a text-only yöntemlerle aktarılır. PWA shell ile uyumlu statik asset'ler ayrıca cache politikasına eklenmelidir.

## DoD

- temel Prompt Library akışı korunur,
- destructive işlemler kullanıcı onayı ister,
- bounded input ve output sınırları vardır,
- modal yüzeyleri erişilebilir semantik taşır,
- storage hataları ana sohbeti durdurmaz,
- source-contract testleri eklenmiştir,
- branch diff'i finalde GitHub compare ile ölçülür,
- merge yalnız PR üzerinden yapılır.
