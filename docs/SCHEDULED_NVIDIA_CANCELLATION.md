# Scheduled NVIDIA cancellation contract

## Amaç

Zamanlanmış Hafize görevlerinde lease kaybı, worker iptali veya process kapanışı oluştuğunda yalnız üst Promise zincirini durdurmak yeterli değildir. Alttaki NVIDIA NIM HTTP isteği de aynı cancellation sinyalini görmeli ve bounded timeout ile birlikte tek bir gerçek request signal'i kullanmalıdır.

## Sözleşme

- NVIDIA NIM ana sağlayıcı olmaya devam eder.
- Scheduled completion çağrısı `(payload, signal)` sözleşmesini taşır.
- Caller signal pre-aborted ise provider çağrısı başlamaz ve `SCHEDULE_AGENT_RUN_CANCELLED` üretilir.
- Caller daha sonra abort olursa aynı abort gerçek NVIDIA request signal'ine aktarılır.
- Her scheduled NVIDIA completion ayrıca `HAFIZE_SCHEDULE_RUN_TIMEOUT_MS` ile bounded olur.
- Geçerli timeout aralığı mevcut server sözleşmesiyle aynıdır: 10 saniye–300 saniye; production varsayılanı 120 saniyedir.
- Timeout caller cancellation değilse `SCHEDULE_AGENT_RUN_TIMEOUT` olarak sınıflandırılır.
- Caller cancellation ile timeout yarışırsa caller cancellation önceliklidir.
- Provider'ın normal bounded hataları yeniden yazılmaz; yalnız cancellation/timeout sınıflandırması schedule katmanında sabit kodlara çevrilir.
- Timer ve parent-signal listener'ları success, provider failure, cancellation ve timeout yollarının tamamında temizlenir.

## Güvenlik sınırı

Bu değişiklik yeni tool izni, yeni endpoint, retry, storage veya credential yüzeyi açmaz. Agent registry ve default-deny tool policy değişmez. `NVIDIA_API_KEY` yalnız mevcut server-side `nvidiaFetch` yolunda kalır ve agent bağlamına taşınmaz.

## Lease ve worker ilişkisi

#265 ve #266 ile schedule worker cancellation sinyali execution runtime ve lease guard üzerinden scheduled-agent executor'a taşınır. Bu sözleşme son eksik halkayı kapatır: executor'un `complete(payload, signal)` çağrısındaki signal artık NVIDIA HTTP isteğinin kendi AbortSignal'ine bağlanır. Böylece lease kaybedilen iş yalnız sonuç seviyesinde iptal edilmez; provider çalışması da mümkün olan en erken anda durdurulur.

## Hata anlamları

- `SCHEDULE_AGENT_RUN_CANCELLED`: caller/lease/worker cancellation.
- `SCHEDULE_AGENT_RUN_TIMEOUT`: scheduled NVIDIA completion için bounded deadline aşıldı.
- `NVIDIA_CHAT_ERROR`, `INVALID_NVIDIA_RESPONSE` ve diğer mevcut provider hataları: cancellation veya schedule timeout değilse aynen mevcut üst katman politikasına bırakılır.

## Geri alma

`lib/scheduled-nvidia-completion.mjs` ve server wiring kaldırılıp eski timeout-only callback geri getirilebilir. Kalıcı veri, schema veya token formatı değişmediği için migration gerekmez.
