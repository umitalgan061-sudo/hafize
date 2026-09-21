# Runtime Resilience

## Neden ayrı bir katman?
Hafize NVIDIA NIM, GitHub, Gmail, Canva, Redis ve scheduled worker gibi dış bağımlılıklarla çalışır. Tekrarlanan timeout ve concurrency kodları yerine ortak, bounded primitive’ler kullanılır.

## Primitive’ler
### withDeadline
Async operasyonu üst süre sınırı ile çalıştırır. Parent AbortSignal aktarılır, timeoutta child controller abort edilir ve timer cleanup yapılır.

### retryWithBackoff
Retry sayısı en fazla 5 attempt ile sınırlıdır. Varsayılan iki attempt, bounded exponential backoff ve açık shouldRetry policy kullanılır. Her hata otomatik retry edilmez.

### createCircuitBreaker
Upstream arızalarında closed -> open -> half-open -> closed durumlarıyla çağrı taşmasını önler. Failure threshold, cooldown ve half-open call sayısı bounded’dır.

### createConcurrencyGate
Aynı anda çalışabilecek iş sayısını ve bekleme kuyruğunu sınırlar. Kuyruk dolduğunda çağrı hızlı ve kontrollü biçimde reddedilir.

### createRuntimeMetrics
Harici telemetry göndermeden bounded sayaç ve süre toplamları tutar. Prompt, token, credential veya ham request body saklamaz.

## NVIDIA entegrasyonu
server.ts içindeki JSON completion yolu timeout boundary, circuit breaker ve sanitized metrics üzerinden geçer.

Inference POST çağrıları için otomatik retry varsayılan değildir; duplicate ücretlendirme ve yinelenen upstream çağrısı riski nedeniyle retry policy explicit kalır.

## Health endpoint
GET /api/health operasyonel özet döndürür: circuit state, çağrı/failure sayaçları, süre agregatları ve readiness bilgileri.

Ham exception mesajları health çıktısında yer almaz.

## Failure semantics
NVIDIA_TIMEOUT
CIRCUIT_OPEN
CONCURRENCY_QUEUE_FULL
ABORTED

## Test
lib/runtime-resilience.test.ts timeout, abort, retry, circuit recovery, concurrency bound ve bounded metrics davranışlarını sınar.

## Rollback
Resilience katmanı tek PR revert’i ile çıkarılabilir. Health response içindeki ek telemetry alanları da aynı anda geri alınır.