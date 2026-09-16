# Zamanlanmış Görevler UI

## Büyük koleksiyon davranışı

Scheduler paneli artık bütün görevleri tek seferde DOM'a basmaz. İlk sayfa 50 kayıttır ve `Daha fazla yükle` ile cursor üzerinden devam edilir. Böylece binlerce kayıt olsa bile ilk açılış maliyeti sabit tutulur.

## Arama

Arama görev metni, ajan id'si, durum ve schedule id üzerinde server-side yapılır. Input 250 ms debounce ile yenilenir; kullanıcı her karakterde ayrı istek yağdırmaz.

## Sıralama

Çalışma zamanı, oluşturulma zamanı ve güncelleme zamanı sıraları desteklenir. Sıralama server tarafında olduğundan pagination ile çakışmaz.

## Filtreler

Durum filtresi server-side query'ye çevrilir. Eski enhancement modülündeki duplicate client-side filter kaldırılmıştır; böylece iki farklı filtre state'i birbirini bozamaz.

## Toplu iptal

Scheduled satırlarda checkbox görünür. En fazla 100 seçim yapılabilir. Kullanıcı onayı olmadan destructive bulk action çalışmaz.

## İstatistik çubuğu

Panel açıldığında kullanıcıya toplam görev ve status dağılımı gösterilir. `unbounded` kapasite bilgisi uygulama seviyesinde sabit görev kotası olmadığını ifade eder.

## Erişilebilirlik

Dialog semantiği, `aria-labelledby`, status live region'ları, checkbox aria-label'ları, keyboard Escape kapanışı ve focus restore korunur. Yeni stats alanı da live status olarak işaretlidir.

## PWA

Stats JS dosyası shell cache'e alınır. API çağrıları cache edilmez. Offline açılışta statik panel kodu hazır olabilir; task verisi ağ/uygulama runtime'ına bağlıdır.

## Mobil

Controls dar ekranlarda tek sütuna düşer. Bulk bar dikey yerleşir. Task satır başlıkları küçük ekranlarda badge ile birlikte kırılabilir.

## Hata mesajları

UI raw backend exception göstermemelidir. `401`, capacity ve generic service errors için kullanıcıya kısa, anlaşılır mesajlar gösterilir.

## Kullanım ilkesi

Sınırsız görev desteği UI'da “çok büyük listeyi aynı anda render etme” şeklinde yorumlanmaz. Pagination ve bounded selection bu nedenle feature'ın ayrılmaz parçasıdır.
