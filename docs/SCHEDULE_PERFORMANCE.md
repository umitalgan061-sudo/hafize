# Schedule Performance Guide

## Primary cost centers

Scheduler performansında dört ana maliyet vardır: store scan/sort, durable snapshot serialization, encryption/compression ve worker execution.

## Store list

`list()` response boyutunu limit ile bounded tutar.

Arama ve sorting mevcut in-memory collection üzerinde gerçekleştirilir.

Bu yaklaşım binlerce görev için yeterlidir ancak yüz binlerce task ve yüksek QPS için gerçek indexli database gerektirir.

## Pagination

Cursor pagination offset tabanlı değildir.

Cursor son görülen sıralama anahtarını ve schedule id'yi taşır.

Bu sayede sayfalar arasında başlangıç offset'inin büyümesine bağlı response payload artmaz.

## Browser rendering

İlk sayfa 50 kayıtla sınırlıdır.

Daha fazla kayıt kullanıcı eylemiyle yüklenir.

DOM'da yalnız yüklenmiş satırlar tutulur.

Search input debounce edilmiştir.

## Worker throughput

Batch 64'e, concurrency 8'e, tick batch count 64'e kadar bounded olabilir.

Varsayılan değerler daha düşüktür.

Bu değerler provider rate limitleriyle birlikte ayarlanmalıdır.

## Persistence

Her mutation snapshot'ın tamamını yazdığı için write amplification büyük collection'da artar.

Gzip özellikle tekrarlı task metinlerinde disk boyutunu azaltır ancak CPU maliyeti getirir.

AES-GCM şifreleme snapshot verisinin plaintext olarak disk üzerinde bulunmasını önler.

## Recommended deployment tiers

### Küçük

0–5.000 task.

Encrypted file storage uygun başlangıç noktasıdır.

Worker concurrency 2–4 aralığında tutulabilir.

### Orta

5.000–50.000 task.

Storage size, mutation latency ve worker backlog izlenmelidir.

Sayfalama zorunlu olarak kullanılmalıdır.

### Büyük

50.000+ task veya yüksek mutation QPS.

Queue/database ve indexed query modeli değerlendirilmelidir.

Snapshot dosyasının tek writer modeli darboğaz olabilir.

## Benchmark önerileri

- 1.000 task create burst;
- 10.000 task list pagination;
- 10.000 task search;
- 1.000 due task drain;
- 100 concurrent schedule create;
- 64 claim batch;
- storage save sonrası reopen.

## İzlenecek metrikler

- create latency p50/p95;
- list latency p50/p95;
- storage save latency;
- snapshot byte size;
- compression ratio;
- due backlog;
- worker execution latency;
- retry count;
- lease contention;
- failed task rate.

## Tuning kuralı

Tek bir parametreyi artırıp diğer sistemleri ölçmeden optimize etmeyin.

Worker throughput artarken downstream provider errors yükseliyorsa concurrency geri alınmalıdır.

Storage size büyüyorsa önce snapshot formatı ve retention politikası değerlendirilmelidir.
