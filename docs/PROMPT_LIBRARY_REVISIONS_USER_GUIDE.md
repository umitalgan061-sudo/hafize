# Revision history — user guide

## Ne işe yarar?

İstem üzerinde yapılan düzenlemelerin önceki hallerini yerelde tutar. Yanlış bir düzenleme olursa önceki sürüme dönmeyi sağlar.

## Ne zaman sürüm oluşur?

Yeni istem oluşturma, içerik değiştirme ve geri yükleme işlemleri revision reason alanıyla kaydedilir. İçerik aynıysa gereksiz kopya oluşturulmaz.

## Geçmişi görüntüleme

Sürüm geçmişi panelinden istem seç. En yeni sürüm üstte görünür. Tarih, sebep, başlık ve kısa gövde önizlemesi gösterilir.

## Geri yükleme

İstediğin sürümde `Geri yükle` düğmesine bas. İşlemden önce mevcut sürüm `before-restore` olarak saklanır. Onay penceresi kapatılırsa hiçbir değişiklik yapılmaz.

## Kullanım sayısı

Geri yüklenen istem mevcut kullanım sayısını korur. Revision history kullanım analitiği yerine içerik geri dönüşü için tasarlanmıştır.

## Sınırlar

Bir istemin en fazla 20 sürümü, tüm kütüphanenin en fazla 600 sürümü tutulur. Eski sürümler bounded policy ile atılır.

## JSON

Sürüm geçmişi JSON olarak dışa aktarılabilir. Dosya yerelde oluşturulur ve backend'e gönderilmez.

## Silinen istem

Bir prompt silinirse orphan revision kayıtları sonraki cleanup işleminde kaldırılır.

## Gizlilik

Revision içeriği yalnız cihazdaki local storage içinde kalır. OAuth, connector, analytics ve cloud sync yoktur.

## Sorun giderme

Geçmiş boş görünüyorsa storage erişimini ve doğru istem seçimini kontrol et. Storage okunamazsa mevcut kullanıcı akışının geri kalanı çalışmaya devam edebilmelidir.

## Geri alma

Revision panelini kaldırmak mevcut prompt kaydını zorunlu olarak silmez. Veri key'i sonraki sürüm için korunabilir.
