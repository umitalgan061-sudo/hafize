# Prompt Library — Sürüm Geçmişi

## Amaç

Sürüm geçmişi, Prompt Library içindeki bir istemin daha önceki içerik durumlarını cihaz üzerinde saklar. Özellik, düzenleme sırasında yanlışlıkla bozulan bir istemi geri almayı ve değişiklikleri incelemeyi kolaylaştırır.

## Kapsam

Her istem için en fazla 10 revision tutulur. En fazla 120 istemin revision alanı bulunabilir. Revision kayıtları ana prompt kayıtlarından ayrı local storage anahtarında tutulur.

## Snapshot

Bir istem düzenlenmeden hemen önce başlık, gövde ve etiketler snapshot olarak alınır. Kullanım sayısı, favori durumu ve istemin kimliği revision gövdesine dahil edilmez.

## Geri yükleme

Geri yükleme kullanıcı onayıyla yapılır. Önce mevcut içerik manuel revision olarak saklanır; ardından seçilen eski içerik ana prompt kaydına uygulanır. Mevcut `favorite` ve `useCount` değerleri korunur.

## Karşılaştırma

Kullanıcı seçilen revision'ın mevcut içerikle aynı olup olmadığını ve karakter uzunluğu farkını görebilir. Önizleme güvenli DOM metni olarak gösterilir.

## Silme ve temizleme

Tek revision silinebilir veya isteme ait tüm revision geçmişi temizlenebilir. Her iki işlem de onay gerektirir.

## Dışa aktarma

Tek istemin revision geçmişi JSON olarak yerel Blob üzerinden dışa aktarılır. Ağ isteği yapılmaz. Export üst sınırı 1 MB'dir.

## Gizlilik

Revision verileri backend'e, analytics sistemine veya telemetry kanalına gönderilmez. Conversation history'den ayrıdır ve connector API'lerine aktarılmaz.

## Kullanıcı ilkeleri

Geri yükleme geri döndürülebilir olmalıdır; işlem mevcut durumu yeni bir manual revision olarak saklar. Bu sayede kullanıcı eski ve yeni durumlar arasında kaybolmadan geçebilir.

## PWA

Revision JavaScript'i service worker shell cache içinde bulunur. Asset güncellemesinde cache sürümü artırılır.
