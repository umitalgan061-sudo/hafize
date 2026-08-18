# Schedule owner kapasite sözleşmesi

Hafize'nin zamanlanmış görev deposu global kapasite sınırına ek olarak principal/owner başına aktif görev sınırı uygular.

## Amaç

Global schedule kapasitesi tek başına çok kullanıcılı ortamda yeterli değildir. Tek bir authenticated principal çok sayıda `scheduled` veya `running` görev oluşturarak ortak kapasiteyi tüketip diğer kullanıcıların görev oluşturmasını engelleyebilir. Bu sınır backend storage katmanında uygulanır; UI veya prompt davranışına güvenmez.

## Varsayılan sınırlar

- Owner başına varsayılan aktif görev sınırı: **100**.
- Test/enjeksiyon için kabul edilen yapılandırma aralığı: **1–1000**.
- Global store kapasitesi varsa ayrıca ve bağımsız olarak geçerliliğini korur.
- Owner kimliği en fazla 200 karakterlik mevcut server-side principal subject sözleşmesinden gelir.

## Hangi durumlar kotaya dahildir?

Yalnız kaynak tüketmeye devam eden durumlar sayılır:

- `scheduled`
- `running`

Şu terminal durumlar owner aktif kotasını tüketmez:

- `completed`
- `failed`
- `cancelled`

Bu ayrım önemlidir. Terminal geçmiş de sayılsaydı bir kullanıcı yaşamı boyunca 100 görev tamamladıktan sonra yeni görev oluşturamaz hale gelirdi.

## Yarış güvenliği

Owner sınırı `createScheduleCommandBoundary` üzerinde bir "snapshot say ve sonra ekle" kontrolü olarak uygulanmaz. Bunun yerine storage runtime, gerçek store'u `createOwnerBoundedScheduleStore` ile sarar.

Aynı owner için `add()` çağrıları owner-local Promise kuyruğunda serialize edilir. Böylece aynı principal'ın eşzamanlı create istekleri aynı anda eski snapshot'ı görerek kotayı aşamaz. Farklı owner'lar birbirini bu kuyruktan dolayı bloke etmez; alttaki durable store kendi mutation sıralamasını korur.

## Hata sözleşmesi

Owner aktif kapasitesi dolduğunda wrapper mevcut `TASK_SCHEDULE_FULL` store hatasını üretir. Böylece command boundary'nin mevcut `SCHEDULE_CAPACITY_REACHED` → HTTP 503 sözleşmesi yeniden kullanılır ve yeni, paralel bir public hata yüzeyi oluşturulmaz.

## Kalıcılık

Owner kotası için ayrı sayaç veya yeni snapshot alanı saklanmaz. Sayaç her create sırasında authoritative schedule snapshot'ındaki owner + aktif status bilgisinden türetilir. Bu nedenle:

- encrypted durable storage şeması değişmez;
- process restart sonrasında sayaç yeniden doğru türetilir;
- ek migration gerekmez;
- sayaç drift riski oluşmaz.

## Bilerek kapsam dışı

Bu değişiklik terminal görev geçmişini otomatik silmez. Global store kapasitesi terminal kayıtlarla zaman içinde dolabilir; otomatik retention/pruning kullanıcı geçmişi kaybı doğurabileceği için ayrı veri saklama politikası, kullanıcı görünürlüğü ve geri alma kararı gerektirir. Bu PR owner fairness sorununu veri silmeden çözer.

## Güvenlik sınırları

- Yeni endpoint veya tool permission yoktur.
- Ajan registry'si ve dört profilli selector/specialist mimarisi değişmez.
- External write/send/merge approval sözleşmeleri değişmez.
- Secret, cookie veya Authorization değeri bu wrapper tarafından okunmaz.
- `shell=True`, child process, exec/spawn veya terminal yürütme yoktur.
- `.env`, credential dosyaları ve `.github/workflows/` değiştirilmez.

## Geri alma

`owner-bounded-schedule-store.mjs` wrapper'ı ve `schedule-storage-runtime.mjs` wiring'i kaldırılır. Snapshot/persistence şeması değişmediği için veri migrasyonu veya rollback scripti gerekmez.
