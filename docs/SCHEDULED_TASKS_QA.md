# Zamanlanmış Görevler — QA Planı

## Amaç

Bu belge, scheduled task UI'nin mevcut backend schedule runtime ile birlikte kabul edilmesi için gereken test alanlarını tanımlar.

## Fonksiyonel senaryolar

Yeni görev formu açılabilmelidir.

Ajan seçenekleri ana registry'den gelmelidir.

Görev metni boş bırakıldığında submit olmamalıdır.

Geçmiş tarih seçildiğinde submit olmamalıdır.

Geçerli gelecekteki tarih kabul edilmelidir.

Maksimum deneme alanı 1–5 olmalıdır.

Başarılı POST sonrasında form temizlenmeli ve liste yenilenmelidir.

POST başarısız olduğunda formdaki kullanıcı girdisi korunmalıdır.

Liste boşken anlaşılır empty state görünmelidir.

Schedule kayıtları runAt sırasına göre gösterilmelidir.

Planlandı kayıtlarında iptal düğmesi bulunmalıdır.

Running, completed, failed ve cancelled kayıtlarında iptal düğmesi bulunmamalıdır.

Trace ID gösterimi task metnini değiştirmemelidir.

## Hızlı şablonlar

Her şablon formun task textarea alanını doldurmalıdır.

Şablon seçimi API çağrısı yapmamalıdır.

Şablon metni kullanıcı tarafından değiştirilebilmelidir.

Şablonların tamamı geçerli non-empty task text olmalıdır.

## Filtreler

Tümü seçildiğinde bütün status satırları görünür.

Planlandı seçildiğinde yalnızca `scheduled` satırları görünür.

Çalışıyor seçildiğinde yalnızca `running` satırları görünür.

Tamamlandı seçildiğinde yalnızca `completed` satırları görünür.

Başarısız seçildiğinde yalnızca `failed` satırları görünür.

İptal edildi seçildiğinde yalnızca `cancelled` satırları görünür.

Filtre yalnızca client görünümünü değiştirir; server state'i değiştirmez.

## API

GET request authenticated session ile yapılmalıdır.

POST request yalnızca izin verilen dört alanı taşımamalıdır; tam olarak desteklenen alanları taşımalıdır.

DELETE path URL encoded olmalıdır.

API response JSON değilse client crash olmamalıdır.

HTTP 401 user-facing authentication mesajına çevrilmelidir.

HTTP 409 yarışan cancel sonucunda liste yeniden okunmalıdır.

HTTP 503 kapasite hatası açıkça belirtilmelidir.

## Durum

Server status UI badge ile birebir eşlenmelidir.

Unknown future status UI çökmesine neden olmamalıdır.

Error code varsa bounded gösterim kullanılmalıdır.

Attempts değeri `attempts/maxAttempts` formatında anlaşılır olmalıdır.

## Zaman

Local datetime input doğru ISO değere çevrilmelidir.

Timezone offset server tarafından doğru kabul edilmelidir.

DST geçişi çevresinde `Date` parsing exception oluşturmamalıdır.

Past time client tarafından reddedilmelidir.

Server validation yine kabul edilmelidir; client validation authorization değildir.

## Erişilebilirlik

Dialog accessible name taşımalıdır.

Form alanları label veya aria-label ile isimlendirilmelidir.

Status updates `aria-live` ile duyurulmalıdır.

Filter select erişilebilir isim taşımalıdır.

Trace button anlamlı accessible label taşımalıdır.

Escape dialog'u kapatmalıdır.

Kapanış sonrası önceki focus öğesi mümkün olduğunda geri alınmalıdır.

Focus görünürlüğü keyboard focus için korunmalıdır.

## Mobil

650px ve altı viewport'ta form tek sütun olmalıdır.

List scroll edilebilir olmalıdır.

Modal viewport dışına taşmamalıdır.

Action button'lar dokunma alanı olarak kullanılabilir durumda kalmalıdır.

Status text yatay taşma oluşturmamalıdır.

## PWA

Scheduled task CSS shell'e dahil olmalıdır.

Scheduled task JS shell'e dahil olmalıdır.

Enhancement JS shell'e dahil olmalıdır.

Cache version değişmelidir.

API path network-only olmalıdır.

## Güvenlik

Client bundle server secret içermemelidir.

Task text innerHTML ile render edilmemelidir.

Task ID route'a ham eklenmemelidir.

OwnerId client'a expose edilmemelidir.

DELETE onaysız çalışmamalıdır.

## Hata enjeksiyonu

Geçersiz JSON response generic UI error üretmelidir.

Network failure empty state gibi maskelenmemelidir.

AbortError kapanış sırasında fatal hata gibi gösterilmemelidir.

503 capacity için kullanıcı tekrar deneyebilir mesajı anlamlı olmalıdır.

Ajan registry boşsa form submit olmamalıdır.

## Regression

Conversation workspace davranışı etkilenmemelidir.

Prompt Library davranışı etkilenmemelidir.

Composer davranışı etkilenmemelidir.

Service worker API sınıflandırması bozulmamalıdır.

Sidebar mobil aç/kapat davranışı korunmalıdır.

Theme değişimleri modal CSS renk değişkenleri ile uyumlu olmalıdır.

## Kabul

Fonksiyonel testlerin tamamı başarılıysa release adayıdır.

Güvenlik testi başarısızsa release durdurulur.

PWA asset testi başarısızsa release durdurulur.

API ownership davranışı başarısızsa release durdurulur.

Local test runner çalıştırılamıyorsa PR bunu açıkça bildirir; test dosyaları yine repoya konur.
