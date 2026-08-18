# Scheduled provider cancellation contract

## Amaç

Zamanlanmış bir Hafize görevi lease kaybı, worker cancellation veya process shutdown nedeniyle artık yürütülmemesi gerekiyorsa yalnız üst seviye promise sonucunu iptal etmek yeterli değildir. Altta devam eden NVIDIA HTTP isteği de mümkün olduğunca hızlı sonlandırılmalıdır. Aksi halde artık sahibi olmayan görev provider zamanı, bağlantı ve token tüketmeye devam edebilir.

## Signal zinciri

Production zinciri şu sırayı korur:

1. `server.mjs` process yaşam döngüsü için tek bir schedule worker `AbortController` tutar.
2. `SCHEDULE_WORKER.runDue({ signal })` caller signal'ini claimed task'a iletir.
3. `schedule-execution-runtime` ve Redis lease guard aynı signal'i yürütülen göreve taşır; lease kaybı kendi cancellation signal'ini de tetikleyebilir.
4. `scheduled-agent-executor` effective task signal'ini `complete(payload, signal)` callback'ine geçirir.
5. Production completion callback'i `runWithScheduleCompletionSignal` ile caller signal'ini bounded provider timeout'u ile birleştirir.
6. Ortaya çıkan tek signal doğrudan `nvidiaJsonCompletion` ve oradan `fetch(..., { signal })` yoluna gider.

Bu zincirde hiçbir katman caller cancellation'ı yalnız promise race ile gizleyip alttaki NVIDIA isteğini çalışır halde bırakmamalıdır.

## Timeout sınırı

`HAFIZE_SCHEDULE_RUN_TIMEOUT_MS` production varsayılanı 120 saniyedir. Server env parser'ı 10 saniye–300 saniye aralığına clamp eder. Ortak signal helper'ı bağımsız kullanımda 1 saniye–300 saniye dışında değeri fail-closed reddeder.

Caller abort timeout'tan önce gerçekleşirse `caller` nedeni kazanır ve timeout timer'ı cleanup edilir. Timeout önce gerçekleşirse `timeout` nedeni kazanır. İkinci abort effective signal'i yeniden değiştirmez.

## Shutdown davranışı

Shutdown sırası schedule worker timer'ını durdurur ve worker controller'ı abort eder; ancak bundan sonra aktif `scheduleTickPromise` beklenir. Böylece shutdown mevcut scheduled NVIDIA isteğinin normal timeout'una kadar beklemek zorunda kalmaz. Worker cancellation semantics claimed görevi uygun bounded retry/defer yoluna taşır ve attempt refund sözleşmesini korur.

## Güvenlik sınırları

- NVIDIA NIM ana provider olmaya devam eder; local provider routing değişmez.
- Yeni endpoint, retry provider, background shell veya genel terminal yürütme eklenmez.
- Tool izinleri model sağlayıcısından bağımsız backend default-deny kalır.
- Dış write/send/merge işlemleri mevcut explicit approval sınırını korur.
- Secret veya credential signal, task ledger ya da agent context içine eklenmez.
- Aktif agent roster'ı iki selector + iki specialist olmak üzere dört profilde kalır.
- `.env`, credential dosyaları ve `.github/workflows/` bu değişikliğin parçası değildir.

## DoD

Regresyonlar en az şunları kanıtlamalıdır:

- caller abort effective provider signal'ini abort eder;
- pre-aborted task provider completion'ı hiç başlatmaz;
- timeout provider signal'ini bounded sürede abort eder;
- caller abort sonrası timeout ikinci kez abort üretmez;
- helper timer ve parent listener cleanup yapar;
- scheduled executor → completion callback zincirinde provider operasyonu gerçekten abort event'i görür;
- production `server.mjs` caller signal'i yok sayan eski local `AbortController` desenine dönmez;
- shutdown worker'ı abort ettikten sonra aktif tick'i bekler;
- roster/default-deny/external approval sözleşmeleri değişmez.

## Geri alma

Bu davranış geri alınacaksa `schedule-completion-signal.mjs`, ilgili server wiring, testler ve bu belge birlikte revert edilmelidir. Schedule store şeması veya kalıcı veri formatı değişmediği için migration gerekmez.
