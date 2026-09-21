# GitHub çalışma alanı support

## Repository neden okunmuyor

Önce repository biçimini sahip/depo olarak kontrol edin. Ardından sunucu allowlist'inde bulunduğunu doğrulayın.

## Auth hatası

AUTH_REQUIRED veya GITHUB_NOT_CONFIGURED görülüyorsa uygulama session ve server-side GitHub configuration kontrol edilmelidir. Browser'a token eklenmemelidir.

## File okunmuyor

Dosya yolu relative olmalı ve traversal segmenti içermemelidir. Secret, credential, private key veya credential içeren içerik güvenlik nedeniyle gösterilmeyebilir.

## Branch seçimi

Branch satırına tıklamak veya Enter/Space kullanmak ref alanını günceller. Sonrasında Commit veya Dosya görünümü yeniden yüklenmelidir.

## PR durumu

PR durum filtresi Açık PR, Kapalı PR ve Tüm PR seçeneklerini kullanır. Liste upstream API'den yeniden okunur.

## Compare

Base ve head birbirinden farklı olmalıdır. Aynı ref seçildiğinde backend isteği reddeder.

## Detay

Commit SHA veya PR numarası ilgili detay alanına girilerek salt-okunur ayrıntı alınabilir. Ayrıntı sonuçları bounded gösterilir.

## Clipboard

Kopyalama browser clipboard API'sine bağlıdır. API yoksa workspace veriyi kaybetmeden durum mesajı gösterir.

## PWA

Stale workspace asset görülürse service worker güncellemesi ve cache version kontrol edilir. API cevaplarının shell cache'e eklenmemesi gerekir.

## Güvenlik ihlali şüphesi

Token browser storage'a yazılmışsa veya secret içerik gösteriliyorsa kullanım durdurulmalı ve ilgili release rollback edilmelidir. Workspace scope genişletilmemelidir.

## Destek notu

Kullanıcıya GitHub token'ını chat alanına, repository prompt'una veya browser storage'a yapıştırması önerilmez. Yetkilendirme server-side configuration üzerinden yürütülür.
