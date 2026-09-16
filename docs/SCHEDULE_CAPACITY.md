# Schedule Capacity Contract

## Uygulama kotası

Default scheduler store görev adedine sabit bir üst sınır koymaz.

`createTaskScheduleStore()` çağrısında `maxEntries` verilmezse kapasite `Infinity` olur.

Bu davranış kullanıcıya “sınırsız görev” olarak yansıtılabilir. Uygulama hiçbir noktada `128`, `1024` veya benzeri sabit görev adedi kontrolü çalıştırmamalıdır.

## İstek sınırları

Görev adedinin sınırsız olması request büyüklüklerinin sınırsız olması anlamına gelmez.

Bir liste response'u en fazla 100 kayıt verir.

Bir bulk cancel çağrısı en fazla 100 schedule id alır.

Görev metni 20.000 karakterle sınırlandırılır.

Arama sorgusu 160 karakterle sınırlandırılır.

Cursor 1024 karakterle sınırlandırılır.

Bu limitler kaynak kötüye kullanımını sınırlar; kullanıcı görevlerinin toplam sayısını sınırlamaz.

## Durable storage sınırı

Encrypted file adapter gerçek dosya boyutunu sınırlar.

Varsayılan maksimum 64 MiB'dir.

Deployment daha büyük kapasite gerekiyorsa `HAFIZE_SCHEDULE_STORAGE_MAX_FILE_BYTES` ile 256 MiB'ye kadar çıkabilir.

Bu limit dolduğunda sistemin yeni kayıt oluşturmak yerine kontrollü storage hatası vermesi beklenir.

## Neden fiziksel sınır var?

Tek dosyalı persistence yaklaşımı atomik ve güvenli bir başlangıç sağlar fakat her mutation sonunda snapshot yazabilir.

Dosya kapasitesi büyüdükçe CPU, disk I/O ve snapshot serialization maliyeti yükselir.

Bu nedenle “unbounded” semantiği uygulama kotasının kaldırılmasıdır; fiziksel kaynakların sonsuz olduğu iddiası değildir.

## Büyüme planı

Küçük kurulumlar encrypted file persistence ile çalışabilir.

Orta kurulumlarda dosya boyutu, write latency ve worker backlog izlenmelidir.

Büyük kurulumlarda schedule verisi ayrı bir persistent database veya queue service'e taşınmalıdır.

Distributed scheduler'da claim işlemleri database/queue seviyesinde atomic lock veya Redis lease ile yapılmalıdır.

## Kullanıcı beklentisi

Kullanıcı peş peşe binlerce görev eklediğinde UI oluşturma işlemini reddetmemelidir.

UI listeyi sayfalı göstermeli ve sadece görünür kayıtları DOM'a eklemelidir.

Stats görünümünde `unbounded` kapasite etiketi kullanılmalıdır.

## Operasyon hedefleri

- kapasiteye bağlı feature flag bulunmaması;
- görev sayısı büyüdüğünde response boyutunun sabit kalması;
- backlog worker concurrency'sinin bounded kalması;
- disk kapasitesi dolduğunda fail-closed davranış;
- storage upgrade sırasında görev snapshot'ının korunması.
