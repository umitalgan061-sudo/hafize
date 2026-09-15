# Yerel Veri Merkezi — Destek

## Kullanıcı paneli bulamıyor

Settings düğmesini açıp kapat ve sayfayı yenile. Data center yalnız Settings workspace DOM'u mevcut olduğunda mount olur.

## Alan sayıları beklenmiyor

Önce ilgili feature'ın storage key'ini ve schema sürümünü kontrol et. Data center migration yapmadığından ürün key'i değişmişse eski değer görünmeyebilir.

## Byte değeri neden yaklaşık?

Browser storage değeri byte üzerinden okunur ve UTF-8 boyutu hesaplanır. Bu, browser'ın gerçek quota muhasebesi değildir.

## Silme sonrası veri geri geliyor

Başka bir feature aynı veriyi yeniden yazıyor olabilir veya başka sekme storage event'i yayınlıyor olabilir. Network sync varsayılmamalıdır.

## Bilinmeyen key mesajı

Bu mesaj hata değildir. Allowlist dışında state bulunduğunu bildirir. Güvenlik gereği otomatik silme yapılmaz.

## Manifest açılmıyor

Browser Blob/Object URL desteğini kontrol et. Başarısız export storage içeriğini değiştirmez.

## Güvenlik bildirimi

Bir kullanıcı verisinin başka domain'e gönderildiğini düşünüyorsa önce browser network tab'ında data center kaynaklı request aranır. Modülün kendi kontratı network çağrısı içermemektedir.

## Escalation

Sorun bir feature'ın storage modelinden kaynaklanıyorsa ilgili feature sahibiyle ayrıştırılmalıdır; data center tarafında key allowlist'ini genişletmek son çare olmalıdır.
