# Health Center Erişilebilirlik

## Semantik yapı

Panel bir `section` olarak oluşturulur ve başlıkla ilişkilendirilir.

Durum mesajı `role=status` ve `aria-live=polite` kullanır.

Sorun listesi `role=list`, her kayıt `role=listitem` olacak şekilde sunulur.

## Klavye

Tüm sağlık düğmeleri native button öğeleridir.

Severity filtresi native select kullanır ve klavye ile erişilebilir.

Panel görünürlüğü `aria-expanded` ile bildirilir.

## Odak

Panel, dışarıdaki composer veya diğer çalışma alanlarının klavye akışını kilitlemez.

Sağlık merkezi ayrı bir yardımcı panel olduğu için focus trap gerektirmez.

## Renk bağımlılığı

Hata, uyarı ve bilgi ayrımı yalnızca renge dayalı değildir; metin ve sayaçla da gösterilir.

Forced-colors modunda border ve background sistem renklerine uyarlanır.

## Mobil

700px altında aksiyonlar iki kolona, istatistikler üç kolona düşer.

Uzun issue listesi bağımsız kaydırılabilir.

## Hareket

Panel işlevi animasyona bağlı değildir.

`prefers-reduced-motion` altında scroll behavior sadeleştirilir.

## Metin güvenliği

Kullanıcı verisi `textContent` ile render edilir.

Prompt başlığı, id ve detaylar HTML markup'a dönüştürülmez.
