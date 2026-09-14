# Kullanım İstatistikleri — Operasyon Rehberi

## Günlük davranış

Kullanım İstatistikleri yalnızca cihazda bulunan Prompt Library kayıtlarını okur. Operasyon sırasında backend loglarında prompt kullanım telemetrisi aranmaz; özellik böyle bir veri üretmez.

Kullanıcı bir istemi `Kullan` ile composer alanına aktardığında çekirdek Prompt Library `useCount` değerini artırır. İstatistik paneli aynı kaydı yeniden okuyarak güncel toplamları gösterir. Panelin amacı davranış analizi sunmak değil, kişinin kendi cihazındaki tekrar kullanılan istemleri bulmayı kolaylaştırmaktır.

## Destek kontrolü

İstatistikler görünmüyorsa önce Prompt Library kartının mevcut olup olmadığı, local storage erişimi ve `hafize.prompt-library.v1` anahtarının geçerli JSON içerip içermediği kontrol edilir. Bozuk veri halinde panelin boş sonuç üretmesi beklenen davranıştır; veri temizleme işlemi destek personeli tarafından otomatik yapılmamalıdır.

Kullanım sayısının yanlış olduğu düşünülüyorsa istem kaydının `id`, `useCount` ve `updatedAt` alanları karşılaştırılır. `useCount` metin veya negatif sayıysa görüntüleme katmanı bunu güvenli değere indirger. Bu durum tek başına kayıt kaybı anlamına gelmez.

## Sürümleme

Yeni usage asset'i shell cache listesinde tutulur. Statik varlık değiştiğinde cache sürümü güncellenmesi mevcut service-worker release yaklaşımına göre yapılmalıdır. Eski shell cache'leri temizleyen mevcut politika korunur.

Dinamik loader ikinci bir usage scripti eklememek için `data-hafize-prompt-usage` işaretini kullanır. Sayfa yaşam döngüsünde iki farklı usage panelinin görünmesi beklenen davranış değildir.

## Geri alma

Kullanım panelinde kritik bir regresyon görülürse ilk güvenli geri alma yolu usage loader'ını kaldırmaktır. Prompt Library'nin ana storage alanı, core CRUD akışı ve kullanım sayısı verisi bu işlemden dolayı silinmemelidir. Daha sonra shell cache varlık listesi yeni release ile eşleştirilir.

## Güvenlik olayı değerlendirmesi

Bir kullanım verisinin ağ üzerinden çıktığına dair belirti görülürse bu özellik kapsamında beklenen bir trafik değildir. Browser network kayıtlarında `prompt-library-usage.js` dışında bir analytics, beacon veya usage API çağrısı araştırılır. Olası veri sızıntısı doğrulanırsa özellik yayınlanmış kabul edilmemeli ve ilgili release geri alınmalıdır.

## QA kanıtı

Release öncesi `test-prompt-library-usage.mjs`, `test-prompt-library-usage-regression.mjs`, `test-prompt-library-usage-data-shapes.mjs` ve `test-prompt-library-pwa-usage.mjs` kontrollerinin sonuçları saklanır. Kod sözleşmesi testleri geçse bile üretim tarayıcısında temel `Kullan → sayı artışı → panel yenilenmesi` smoke akışı ayrıca doğrulanmalıdır.
