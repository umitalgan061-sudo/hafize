# Runtime Fixture

Test fixture gerçek tarayıcı yerine Map tabanlı bir Storage benzeri nesne sağlar.

Desteklenen metodlar:
- get length
- key
- getItem
- setItem
- removeItem
- has
- dump

Fixture'ın amacı browser API'lerini birebir taklit etmek değil, privacy module'ün storage sözleşmesini gerçek Node runtime'da sınamaktır.

Fixture içine gerçek kullanıcı verisi yazılmamalıdır.
