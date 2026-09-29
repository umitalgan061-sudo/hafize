# Koleksiyon Merge Notu

Bu özellik Prompt Library'nin yerel grouping katmanını ekler.

Base commit tur başlangıcında main üzerinde doğrulanmalıdır.

Head branch hafize/auto-prompt-collections-0929 olmalıdır.

Merge öncesi GitHub compare ile additions + deletions hesaplanmalıdır.

3000 hard limit aşılırsa yeni dokümantasyon veya kod eklenmemelidir.

PR body:
- what
- why
- test
- rollback
- changed lines

Merge sonrası main ref doğrulanmalıdır.

Merge commit SHA release evidence olarak saklanmalıdır.

CI run yoksa bu durum açıkça raporlanır; test sonucu varmış gibi sunulmaz.

Collection feature rollback'ı prompt core storage'ını silmemelidir.

Migration destructive olmamalıdır.

Security surface değişmediği açıkça belirtilmelidir.
