# Hafize agent cancellation modeli

Bu belge HTTP agent-run, delegated child agent, tool yürütme ve zamanlanmış görev lease yaşam döngülerindeki iptal sözleşmesini tanımlar.

## Temel ilke

Cancellation bir **yetki değildir**. Bir AbortSignal hiçbir tool'u görünür yapmaz, agent tool policy'sini genişletmez ve approval-required işlemi onaylamaz. Önce mevcut backend default-deny authorization uygulanır; signal yalnız başlamasına zaten izin verilmiş çalışmanın bekleyişini sonlandırabilir.

## HTTP agent-run

`/api/agent/run` request controller signal'ı top-level delegator'a `parentSignal` olarak bağlanır. İstemci bağlantısı kapanırsa aktif child delegation lease'leri abort olur. Delegator'ın ürettiği child-local signal ve depth kaybolmadan `runDelegatedAgent`'a taşınır.

Individual child cancellation yalnız ilgili child lease'i etkiler. Parent request cancellation ise aynı parent altındaki aktif child'lara yayılır.

## Delegated model ve tool çağrıları

`runDelegatedAgent` signal'ı model completion çağrılarına ve tool execution context'ine taşır. Tool runtime authorization kontrolünü signal kontrolünden önce korur; cancellation mevcut permission kararını değiştirmez.

Yetkili bir tool çalışırken signal abort olursa runtime bekleyişi `TOOL_EXECUTION_CANCELLED` ile sonlandırır. Delegated runner bunu dış sonuçta `DELEGATION_CANCELLED` olarak normalize eder ve ikinci model completion'a devam etmez. Tool'un underlying connector fonksiyonu AbortSignal'ı native olarak desteklemese bile Hafize o geç sonucu kullanmaz.

## Zamanlanmış görevler ve lease kaybı

Lease guard acquired execution için ayrı bir AbortController üretir. Renew sonucu `stale` olduğunda veya renew hata verdiğinde signal `SCHEDULE_LEASE_LOST` reason ile abort edilir.

Scheduled agent executor bu signal'ı agent/model zincirine geçirir. Provider adaptörü signal'ı native olarak desteklemese bile completion bekleyişi cancellation wrapper ile kesilir. Lease kaybından sonra eski worker'ın sonucu `complete` edilmez.

## Gözlemlenebilirlik

- Tool cancellation ledger'da `TOOL_EXECUTION_CANCELLED` olarak başarısız tool kaydı bırakabilir.
- Child delegation cancellation dışarı `DELEGATION_CANCELLED` olarak normalize edilir.
- Schedule lease kaybının nihai sonucu `SCHEDULE_LEASE_LOST` olur.
- Abort reason iç exception, token, credential veya connector response detaylarını kullanıcıya taşımak için kullanılmaz.

## Bilinçli sınırlar

Cancellation, underlying üçüncü taraf isteğini ancak ilgili connector/provider AbortSignal'ı gerçekten tüketiyorsa fiziksel olarak durdurabilir. Desteklemeyen entegrasyonlarda Hafize Promise bekleyişini keser ve geç sonucu yok sayar. Gelecekte dış yazma yapan tool'lar açılırsa cancellation, kullanıcı approval veya idempotency/fencing mekanizmasının yerine geçmez.
