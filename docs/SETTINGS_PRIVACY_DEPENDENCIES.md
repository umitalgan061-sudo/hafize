# Bağımlılık Politikası

Privacy Center yeni npm dependency eklemez.

Browser'da standart DOM, localStorage, TextEncoder, Blob, URL ve opsiyonel storage estimate/clipboard yeteneklerine dayanır.

Server dependency, API route veya database migration yoktur.

Bu izolasyon feature rollback'ini kolaylaştırır ve bundle riskini düşük tutar.
