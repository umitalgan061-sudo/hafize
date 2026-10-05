# Üretim Kontrolü — Operasyon

## İzlenecek göstergeler

Generation control cihaz üzerinde yalnız bounded metadata tutar. İncelenecek temel sinyaller son 12 çalışmanın completed, aborted ve failed dağılımıdır.

History özeti:

- toplam kayıt,
- tamamlanan / durdurulan / hatalı sayıları,
- toplam üretim süresi,
- toplam okunan byte,
- toplam SSE event sayısı.

## Operatör davranışı

Kullanıcının üretimi durdurması beklenen bir kontrol akışıdır. SSE_ABORTED bir server incident olarak yorumlanmaz.

SSE_TIMEOUT, SSE_NETWORK_ERROR, NVIDIA_* veya bilinmeyen stream hataları görülürse tanı özetindeki çalışma numarası, süre, byte/event bilgisi ve hata kodu incelenir. Prompt veya response içeriği operational log'a taşınmaz.

## Storage sağlığı

Generation history 12 kayıt ve 24 KB JSON ile sınırlıdır. History yazılamazsa ana chat akışı devam eder.

Tarayıcı depolama temizliği history'yi temizleyebilir; conversation, prompt library ve credentials alanlarına dokunmaz.

## PWA

Generation control stylesheet PWA shell cache içindedir. Controller app-shell bundle'ına TypeScript importu olarak katılır. Offline event'i aktif stream'i kontrollü biçimde abort eder.

## Incident inceleme

1. Üretim kontrolündeki phase'i kaydet.
2. Tanı özetinden run id, duration, events, bytes ve error code alanlarını kontrol et.
3. Son beş history kaydında tekrar eden hata örüntülerini incele.
4. Server tarafında mevcut trace/request id observability kayıtlarını prompt veya cevap metni taşımadan sorgula.
5. Network ve model durumu düzeldikten sonra yeni üretim kullanıcı tarafından başlatılmalıdır.

## Geri dönüş

Generation controller rollback'i app-shell importunu kaldırarak yapılabilir. Conversation schema değişmediği için kullanıcı sohbetleri etkilenmez. History key'i ayrı kalabilir ve sonraki sürümde temizlenebilir.
