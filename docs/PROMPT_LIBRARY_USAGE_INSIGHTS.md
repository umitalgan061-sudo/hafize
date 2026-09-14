# İstem Kütüphanesi — Kullanım İstatistikleri

## Amaç

Kullanım İstatistikleri bölümü, Prompt Library içindeki tekrar kullanım alışkanlığını cihaz üzerinde görünür kılar. Bu tur yeni bir sunucu servisi veya telemetri eklemez; mevcut `useCount` alanını kullanıcıya anlamlı bir özet olarak sunar.

## Gösterilen ölçüler

- **Kayıt:** kütüphanedeki normalize edilmiş toplam istem sayısı.
- **Kullanılan:** en az bir kez `Kullan` ile kullanılan istem sayısı.
- **Toplam kullanım:** bütün istemlerin güvenli `useCount` toplamı.
- **En çok kullanılan:** kullanım sayısına göre ilk beş istem.
- **Son kullanılan:** istemin mevcut güncelleme zamanına göre son beş kullanım adayı.

## Veri sınırları

İstatistik modülü doğrudan `localStorage` içindeki `hafize.prompt-library.v1` verisini okur. Geçersiz veya bozuk JSON durumunda boş koleksiyon kabul edilir. Kullanım sayısı negatif, sayı olmayan veya aşırı büyükse görüntüleme katmanı güvenli bir sınır uygular.

İstatistikler ayrı bir veri deposu oluşturmaz. Bu, Prompt Library'nin tek kaynak ilkesini korur ve iki farklı yerel kaydın zamanla birbirinden kopmasını engeller.

## Gizlilik

İstem başlıkları yalnızca mevcut cihaz ekranında özetlenir. Veriler backend'e gönderilmez; `fetch`, `XMLHttpRequest`, WebSocket veya harici analytics çağrısı bulunmaz. PWA önbelleğine yalnızca statik JavaScript/CSS varlıkları eklenir.

## Erişilebilirlik

Panel başlığının bir erişilebilir adı vardır. Göster/gizle kontrolü `aria-expanded` ile durumunu bildirir. İstatistik listeleri `role="list"` ve `role="listitem"` kullanır. Dinamik metin DOM `textContent` üzerinden yerleştirildiğinden kullanıcı verisi HTML olarak yorumlanmaz.

## Güncelleme davranışı

Prompt kullanıldığında çekirdek modül `useCount` değerini artırır ve tekrar render eder. İstatistik modülü MutationObserver ile liste değişikliklerini izler; ayrıca `storage` olayında doğrudan yenilenir. Bu yapı aynı sekmede ve başka sekmede yapılan yerel güncellemelerin ek bir backend bağımlılığı olmadan görünür olmasını sağlar.

## PWA ve geri alma

`prompt-library-usage.js`, mevcut shell cache politikasına eklenmiştir. Özelliği geri almak için önce script yükleyicisini ve ilgili CSS'i kaldırmak, sonra shell cache sürümünü artırmak yeterlidir. Prompt Library verisi aynı storage anahtarında kaldığından özelliğin geri alınması kayıtların silinmesini gerektirmez.

## Kabul kriterleri

1. Kullanım sayısı mevcut Prompt Library kaydıyla aynı kaynaktan hesaplanır.
2. Bozuk storage uygulamanın diğer sohbet işlevlerini durdurmaz.
3. Panel gizlenebilir ve buton durumu ekran okuyucuya aktarılır.
4. Kullanıcı verisi `innerHTML` ile DOM'a yazılmaz.
5. PWA shell, kullanım modülünü offline yükleyebilecek şekilde önbelleğe alır.
6. İstatistik modülü herhangi bir uzak veri gönderimi yapmaz.
