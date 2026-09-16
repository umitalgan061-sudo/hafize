# Prompt Library Collections

## Amaç

Prompt Library içindeki istemleri konu, iş akışı veya proje bazında yerel koleksiyonlarda gruplayabilmek.

## Davranış

Koleksiyonlar yalnızca tarayıcı cihazında tutulur. Backend API, analytics, telemetry veya uzaktan senkronizasyon yoktur. Her koleksiyon bir ad, isteğe bağlı açıklama ve prompt id listesi taşır.

Koleksiyon üyeliği prompt metninin kopyasını oluşturmaz; yalnızca id referansı tutar. Böylece aynı istem birden fazla koleksiyonda kullanılabilir ve tek kaynak korunur.

## İşlemler

- koleksiyon oluşturma
- ad ve açıklama düzenleme
- koleksiyon silme
- seçili istemleri koleksiyona ekleme
- seçili istemleri koleksiyondan çıkarma
- koleksiyona göre liste filtreleme
- koleksiyon JSON dışa aktarma
- koleksiyon JSON içe aktarma
- import sonrası duplicate adları atlama

## Sınırlar

En fazla 40 koleksiyon saklanır. Her koleksiyonda en fazla 120 prompt id tutulur. İsim 80, açıklama 240 ve arama sorgusu 100 karakterle sınırlıdır. Import dosyası 500 KB ile sınırlandırılmıştır.

## Orphan policy

Prompt silindiğinde koleksiyon üyesi olarak kalan id'ler bir sonraki okuma/render işleminde otomatik temizlenir. Koleksiyon silmek prompt'un kendisini silmez.

## UX

Panel Prompt Library kartının içinde açılır. Gizle/göster, arama, filtreleme ve toplu üyelik işlemleri keyboard ve screen reader ile kullanılabilecek explicit button/select semantiğine sahiptir.

## Güvenlik

Kullanıcı metni HTML string interpolation ile yazılmaz. İsim, açıklama ve prompt id değerleri explicit DOM APIs ile yazılır. Dış servis çağrısı bulunmaz.

## Geri alma

Panel JS ve CSS entry'lerini geri almak koleksiyon storage kayıtlarını silmeyi gerektirmez. Eski sürüm yeni paneli göstermese bile veri anahtarı sonraki sürüm tarafından tekrar okunabilir.

## Kabul ölçütleri

Feature release edilmeden önce CRUD, duplicate name, bounds, orphan pruning, import/export, DOM safety, lifecycle ve PWA cache sözleşmeleri test edilmelidir.
