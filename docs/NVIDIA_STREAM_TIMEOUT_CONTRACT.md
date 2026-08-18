# NVIDIA streaming lifetime contract

Hafize'nin NVIDIA NIM streaming yolu yalnız byte miktarıyla değil, toplam yaşam süresiyle de bounded olmalıdır.

## Amaç

Streaming cevap açık kaldığı halde provider hiçbir zaman tamamlanmazsa veya bağlantı yarı-açık durumda takılırsa Node request'i süresiz beklememelidir. Bu sözleşme, mevcut kullanıcı cancellation davranışını bozmadan NVIDIA stream için üst süre sınırı ekler.

## Production sınırları

- NVIDIA NIM ana sağlayıcı olmaya devam eder.
- Varsayılan toplam NVIDIA stream süresi: **300.000 ms (5 dakika)**.
- Runtime test/enjeksiyon üst sınırı: **600.000 ms (10 dakika)**.
- Stream timeout değeri 1.000 ms'den küçük veya 600.000 ms'den büyük olamaz.
- Mevcut toplam stream byte sınırı **8 MiB** olarak korunur.
- Mevcut tek chunk sınırı **512 KiB** olarak korunur.
- NVIDIA endpoint'i HTTPS ve redirect-error politikasıyla kullanılmaya devam eder.

Bu süre bir "idle timeout" değildir; stream'in ilk fetch başlangıcından iterator tamamlanana kadar toplam yaşam süresidir. Böylece yavaş fakat sürekli veri üreten bir stream de mutlak üst sınıra tabidir.

## Cancellation birleşimi

NVIDIA stream için kullanılan AbortSignal iki kaynaktan etkilenir:

1. üst katmandan gelen kullanıcı/request cancellation signal'i,
2. bounded stream deadline'ı.

Caller signal abort olursa aynı reason bağlı request signal'ine taşınır. Bu durum timeout olarak yeniden etiketlenmez; ortak provider boundary bunu `MODEL_PROVIDER_CANCELLED` olarak ele almaya devam eder.

Deadline dolarsa bağlı signal abort edilir ve public hata `NVIDIA_STREAM_TIMEOUT` / HTTP 504 olur. Ham `AbortError`, provider response body, stack trace veya secret istemciye taşınmaz.

## Timer ve listener yaşam döngüsü

Deadline timer'ı şu durumlarda temizlenmelidir:

- stream normal tamamlanırsa,
- consumer iterator'ı erken kapatırsa,
- fetch başlamadan hata oluşursa,
- HTTP response başarısızsa,
- response media-type geçersizse,
- caller cancellation oluşursa.

Normal tamamlanmış bir stream daha sonra deadline nedeniyle abort edilmemelidir. Caller signal listener'ı dispose sırasında kaldırılmalıdır.

## Public hata allowlist'i

Provider boundary aşağıdaki NVIDIA hata kodlarını güvenli ve bounded public hata olarak tanır:

- `NVIDIA_CHAT_ERROR` → 502
- `NVIDIA_CHAT_TIMEOUT` → 504
- `NVIDIA_STREAM_TIMEOUT` → 504
- `NVIDIA_RESPONSE_TOO_LARGE` → 502
- `NVIDIA_STREAM_TOO_LARGE` → 502
- `NVIDIA_STREAM_CHUNK_TOO_LARGE` → 502
- `INVALID_NVIDIA_RESPONSE_TYPE` → 502
- `INVALID_NVIDIA_RESPONSE` → 502

Allowlist dışındaki provider exception/message değerleri `MODEL_PROVIDER_FAILED` olarak redakte edilir. Explicit caller abort her zaman 499 `MODEL_PROVIDER_CANCELLED` önceliğini korur.

## Tool ve secret sınırı

Bu değişiklik yalnız transport lifecycle sertleştirmesidir.

- Model seçimi yeni tool yetkisi vermez.
- Dört profilli agent registry değişmez.
- Backend `denyByDefault` tool enforcement korunur.
- Dış write/send/merge işlemleri açık onay gerektirmeye devam eder.
- NVIDIA API key agent context'e veya public hata payload'ına girmez.
- Local/Ollama seçimi NVIDIA'ya sessiz fallback yapmaz.
- Memory, Gmail, Canva, GitHub write veya schedule permission modeli değişmez.

## Test sözleşmesi

Regresyon testleri en az şunları kanıtlar:

1. bounded abort runtime parent cancellation'ı aynı signal zincirine taşır,
2. timeout bağlı signal'i abort eder ve dispose timer/listener'ı temizler,
3. normal NVIDIA stream deadline dolmadan tamamlanır ve sonradan abort edilmez,
4. toplam stream deadline aşılırsa `NVIDIA_STREAM_TIMEOUT` 504 üretilir,
5. caller cancellation timeout olarak yanlış sınıflandırılmaz,
6. HTTP/media-type erken hataları deadline timer'ını bırakmaz,
7. güvenli NVIDIA hata kodları boundary'de exact allowlist ile korunur,
8. bilinmeyen/private exception metni istemciye sızmaz.

## Bilerek kapsam dışı

Bu PR production `server.mjs` içindeki scheduled-agent özel NVIDIA callback'ini değiştirmez. Schedule worker/lease cancellation zinciri hazır olsa da callback'in caller signal ile kendi timeout controller'ını birleştirmesi ayrı server wiring değişikliğidir. Connector satır-patch desteği olmadığında büyük `server.mjs` dosyasını tahminle yeniden yazmak yerine bu takip işi ayrı ve güvenli bir turda ele alınmalıdır.
