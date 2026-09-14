# İstem Kütüphanesi — Kullanım Özelliği İnceleme Notları

## İncelenen yüzeyler

Bu turdaki ana değişiklik, mevcut Prompt Library kullanım verisini yeni bir uzak servis eklemeden görünür hale getirmektir. İnceleme; veri bütünlüğü, istemci güvenliği, yaşam döngüsü, PWA davranışı ve erişilebilirlik eksenlerinde yapılır.

## Veri bütünlüğü

`useCount` yalnızca geçerli ve sınırlı bir tam sayı olarak değerlendirilir. İstatistik katmanı ana storage kaydını değiştirmez; normalize edilmiş Prompt Library verisini doğrudan okuyarak hesaplama yapar. Böylece istatistik ekranının hata vermesi kayıt kaybına yol açmaz.

Yeni panel, bilinmeyen kayıt şekillerine karşı savunmalıdır. Bozuk JSON, boş koleksiyon, eksik başlık, negatif kullanım sayısı ve sayısal olmayan kullanım değeri gibi durumlar kullanıcı arayüzünün diğer bölümlerini bozmadan ele alınır.

## Güvenlik incelemesi

Panelde prompt başlıkları ve diğer kullanıcı verileri `textContent` ile yerleştirilir. HTML string birleştirme, `innerHTML`, `document.write` ve `insertAdjacentHTML` kullanılmaz. Özellik dış ağ bağlantısı kurmaz ve analytics/telemetri servisine veri taşımaz.

PWA shell listesine eklenen dosya statik bir JavaScript varlığıdır. API uçları halen network-only politikasında kalır; prompt kullanım verisi hiçbir API isteğine bağlanmaz.

## Yaşam döngüsü

İstatistik modülü yalnızca Prompt Library kartı mevcutsa mount edilir. Tekrarlı script eklenmesini `data-hafize-prompt-usage` işaretiyle engeller. MutationObserver ve storage listener yaşam döngüsü `destroy` sırasında kapatılır. Timer temizliği de kapanışta yapılır.

Enhancement katmanı usage scriptini dinamik olarak yüklediği için mevcut `index.html` script zincirine yeni bir bağımlılık sırası zorlamaz. Kullanım modülü shell cache'e alındığı için çevrimdışı açılış akışıyla uyumludur.

## Erişilebilirlik incelemesi

Panel başlığı, `aria-labelledby` ile kendi erişilebilir adını taşır. Aç/kapat kontrolü buton tipindedir ve `aria-expanded` ile görsel durumla aynı semantiği bildirir. Liste öğeleri `role="listitem"` ile anlamlandırılır. Mobil genişlikte istatistik kartları tek kolona düşer; metin taşması başlık satırlarında kesilmek yerine kontrollü gösterilir.

`prefers-reduced-motion` ve `forced-colors` kuralları mevcut Prompt Library stilleriyle birlikte korunur. Panelin aç/kapanması animasyona bağlı değildir.

## Performans incelemesi

İstatistik hesaplaması yalnızca en fazla mevcut Prompt Library sınırı kadar kaydı işler. En çok kullanılan ve son kullanılan listeleri beş öğeyle sınırlandırılır. Observer callback'i kısa bir gecikmeyle gruplanarak hızlı ardışık DOM güncellemelerinde gereksiz tekrar hesaplama azaltılır.

## Test matrisi

- Kullanım sayısı toplamı ve kullanılan kayıt sayısı doğru hesaplanır.
- Sıralama beş sonuçla sınırlı kalır.
- Geçersiz kullanım değerleri güvenli biçimde normalize edilir.
- Uzak ağ API'si veya telemetry çağrısı oluşturulmaz.
- Dinamik metin HTML olarak yorumlanmaz.
- Kullanım paneli ikinci kez mount edilmez.
- Observer ve storage listener kapanışta kaldırılır.
- PWA shell usage varlığını içerir.
- Mobil, forced-colors ve reduced-motion stilleri bulunur.

## Yayın kararı

Özellik mevcut `useCount` sözleşmesini kullandığı için veri migrasyonu gerektirmez. Eski kayıtlar kullanım sayısı olmadan geldiğinde `0` kabul edilir. Geri alma, Prompt Library kayıtlarını silmeden yalnızca kullanım yüzeyini ve shell asset girişini geri çevirecek kadar küçüktür.
