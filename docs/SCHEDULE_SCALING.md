# Zamanlanmış Görevler — Ölçekleme Mimarisi

## Amaç

Bu sürüm, scheduler üzerinde yapay görev sayısı sınırını kaldırır. Varsayılan store kapasitesi `Infinity` olduğundan uygulama seviyesinde `128` veya `1024` gibi sabit bir görev kotası uygulanmaz.

Bu ifade fiziksel altyapının sonsuz olduğu anlamına gelmez. Bellek, disk, CPU, Redis ve ağ kapasitesi her deployment için gerçek sınırlar olmaya devam eder. Uygulamadaki tasarım hedefi, kullanıcı başına keyfi bir sayısal kota koymak yerine bu fiziksel sınırları ölçülebilir ve yapılandırılabilir hale getirmektir.

## Büyük koleksiyon ilkeleri

Listeleme hiçbir zaman bütün görevleri tek HTTP cevabında döndürmez. Varsayılan sayfa 50, üst sınır 100 kayıttır. Cursor opaque base64url biçimindedir ve sıralama anahtarını taşır.

Arama görev kimliği, ajan kimliği, görev metni, durum ve son hata alanlarında yapılır. Durum ve sıralama filtreleri sunucu tarafında uygulanır.

Toplu iptal en fazla 100 kimlikle sınırlandırılmıştır. Bu sınır kapasite limiti değildir; tek isteğin maliyetini ve kullanıcı arayüzünün yanlışlıkla büyük bir yıkıcı işlem yapmasını kontrol eder.

## Worker ölçeklemesi

Worker due görevleri 64'e kadar claim edebilir. Her tick içinde birden fazla batch işlenebilir ve yürütmeler kontrollü eşzamanlı dalgalar halinde yapılır. Varsayılan eşzamanlılık 4, çalışma zamanı üst sınırı 8'dir.

Bu model tüm görevleri aynı anda başlatmaz. Amaç kuyruk backlog'unu azaltırken NVIDIA, GitHub ve diğer bağlı servisler üzerinde ani yük patlamaları oluşturmamaktır.

## Cursor sözleşmesi

Cursor yalnız scheduler'ın ürettiği bir değerdir. İstemci cursor içeriğini yorumlamamalı veya değiştirmemelidir. Cursor farklı bir sort değeriyle tekrar kullanılırsa istek reddedilir.

`runAt-asc` için cursor sonrası öğeler artan sırada alınır. `created-desc` ve `updated-desc` sıralarında zaman anahtarı ters yönde ilerler; eşit zamanlarda `schedule_N` kimliği deterministic tie-breaker olarak kullanılır.

## Kimlik üretimi

Schedule kimlik sayacı `BigInt` tabanlıdır. Böylece JavaScript `Number.MAX_SAFE_INTEGER` sınırına yakın koleksiyonlarda kimlik çakışması oluşturulmaz.

## Sağlık metrikleri

`GET /api/schedules/stats` kullanıcıya toplam görev, durum dağılımı, due görev ve retrying görev sayılarını döndürür. Kapasite alanı `unbounded` olduğunda store üzerinde yapay görev kotası bulunmadığını ifade eder.

## Beklenen deployment yolu

Orta hacimde mevcut encrypted-file persistence kullanılabilir. Yük büyüdükçe storage ve worker kaynakları ayrı ölçeklenmelidir. File snapshot yaklaşımında her kalıcı mutasyon bütün snapshot'ın atomik olarak yeniden yazılmasını gerektirir; çok yüksek yazma oranlarında merkezi queue/database tabanlı bir backend daha uygun olacaktır.

## Doğrulama kriterleri

Bir deployment aşağıdaki davranışları sağlayabilmelidir:

- binlerce görev oluşturulabilir;
- listeleme sabit boyutlu sayfalarda kalır;
- iki kullanıcı birbirinin görevlerini göremez veya iptal edemez;
- due backlog worker tarafından bounded concurrency ile eritilir;
- persistence yeniden açıldığında görev kimlikleri ve durumlar korunur;
- fiziksel storage sınırına gelindiğinde işlem kontrollü hata ile durur.
