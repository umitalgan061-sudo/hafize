# Schedule Failure Modes

## Storage load failure

Şifreli schedule dosyası okunamazsa runtime boş task listesiyle devam etmemelidir.

Startup kontrollü biçimde fail eder.

Bu davranış sessiz veri kaybını önler.

## Storage save failure

Adapter save işlemi başarısız olduğunda persistence state'i yeni snapshot'a geçirilemez.

Mutation caller'ı `SCHEDULE_PERSISTENCE_SAVE_FAILED` türü bir hata görür.

Geçici dosya temizlenir.

## Invalid snapshot

Şema dışı alan, duplicate id, geçersiz status veya bozuk attempt ilişkisi restore sırasında reddedilir.

## Capacity reached

Uygulama görev adedi sınırı uygulamasa bile encrypted dosya kapasitesi dolabilir.

Bu durumda create işlemi provider çağrısı yapmadan durur.

UI kullanıcıya storage kapasitesi kaynaklı bir sorun olduğunu söylemelidir.

## Cursor invalid

Bozuk, aşırı uzun veya farklı sort değerine ait cursor 400 sınıfı hata oluşturur.

İstemci invalid cursor aldığında cursor'ı saklamadan ilk sayfaya dönmelidir.

## Owner mismatch

Bir kullanıcı başka kullanıcıya ait schedule id gönderirse schedule bulunamadı gibi ele alınır.

Kaydın gerçekten var olup olmadığı dışarı sızdırılmaz.

## Bulk cancellation partial result

Toplu iptal çağrısında bazı kayıtlar artık scheduled değilse yalnız uygun kayıtlar iptal edilir.

Bu durum transaction-wide failure olarak değerlendirilmez.

## Unknown agent

Worker execution başlamadan önce registry doğrulaması yapar.

Agent artık yoksa schedule terminal failed durumuna alınır.

## Provider exception

Agent executor exception mesajı public payload'a taşınmaz.

Worker bunu güvenli bir error code'a normalize eder.

Retry bütçesi uygunsa yeniden schedule edilir.

## Lease contention

`SCHEDULE_LEASE_BUSY` gerçek task failure sayılmaz.

Worker schedule'ı defer eder ve attempt hakkını iade eder.

## Unexpected worker rejection

Executor wrapper dışında kalan beklenmedik rejection olursa recovery yolu schedule'ın hala `running` olup olmadığını kontrol eder.

Running durumundaysa kontrollü execution failure'a çevrilir.

## API malformed body

JSON parse problemi veya izin verilmeyen alanlar command boundary'ye ulaşmadan normalleştirilmelidir.

## XSS

Scheduled task metni HTML olarak yorumlanmamalıdır.

UI task başlığı ve gövdesini DOM text node olarak ekler.

## Resource exhaustion

Task metni, query, cursor ve bulk id listesinde bounded input limitleri vardır.

Worker'da concurrency ve batch sayısı bounded'dır.

## Recovery priority

Önce veri bütünlüğü, sonra owner izolasyonu, sonra worker throughput'u korunur.

Bir performance optimizasyonu bu sıralamayı değiştirmemelidir.
