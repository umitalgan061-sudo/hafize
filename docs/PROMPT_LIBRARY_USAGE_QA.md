# İstem Kütüphanesi — Kullanım İstatistikleri QA

## Fonksiyonel kontrol

Yeni istem oluşturulduğunda kullanım sayısı `0` görünmelidir. `Kullan` akışı başarıyla tamamlandığında sayı `1` artmalıdır. Aynı istem ardışık kullanıldığında artış korunmalıdır. Çoğaltılan istem sıfır kullanım ile başlamalıdır.

Panelde toplam kayıt sayısı mevcut kütüphaneyle eşleşmelidir. En az bir kez kullanılan kayıt sayısı ve toplam kullanım değeri aynı storage verisinden hesaplanmalıdır. En çok kullanılan listede daha yüksek sayı üstte olmalı; eşitlikte daha yeni kayıt öne çıkmalıdır.

## Bozuk veri kontrolü

`useCount: -1`, `useCount: "5"`, `useCount: Infinity` veya eksik `useCount` gibi değerler arayüzü bozmamalıdır. Bozuk JSON veya storage erişim hatası istatistik panelinin boş durum göstermesine izin vermeli; sohbet uygulaması kapanmamalıdır.

## Yaşam döngüsü kontrolü

Prompt Library kartı yokken usage modülü sessizce çalışmamalıdır. Kart sonradan oluştuğunda tek mount gerçekleşmelidir. İkinci yükleme yeni bir panel üretmemelidir. `destroy()` sonrasında observer ve storage listener tekrar render üretmemelidir.

## Erişilebilirlik kontrolü

Göster/gizle butonunun adı ve `aria-expanded` değeri görünür durumla eşleşmelidir. Panel başlığı `aria-labelledby` üzerinden hedeflenmelidir. Liste ve satır semantiği ekran okuyucu ile anlamlı olmalıdır. Klavye odağı mevcut `.prompt-library-card button:focus-visible` kuralıyla görünür kalmalıdır.

## Güvenlik kontrolü

Başlık ve istatistik metinleri DOM API ile yerleştirilmelidir. Prompt metni HTML olarak değerlendirilmemelidir. İstatistikler için ağ isteği, analytics beacon, cookie veya sunucu tarafı persistence eklenmemelidir.

## PWA kontrolü

`prompt-library-usage.js` shell asset listesinde bulunmalıdır. Eski cache adları temizlenmeye devam etmeli, API istekleri network-only kalmalıdır. Usage scripti çevrimdışı shell içinde yüklenebilmelidir.

## Performans kontrolü

Panel maksimum Prompt Library kayıt sınırı üzerinde ek veri büyütmemelidir. İlk beş “en çok kullanılan” ve ilk beş “son kullanılan” dışındaki kayıtlar özet listelerine eklenmemelidir. Hızlı DOM yenilemelerinde timer ile gruplanmış refresh kullanılmalıdır.

## Kabul kararı

Fonksiyonel, veri bütünlüğü, erişilebilirlik, güvenlik, PWA ve yaşam döngüsü kontrolleri birlikte geçtiğinde Kullanım İstatistikleri yüzeyi Prompt Library turu için yayınlanabilir kabul edilir.
