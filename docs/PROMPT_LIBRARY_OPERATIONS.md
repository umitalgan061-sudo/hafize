# Prompt Library Operasyonel Değişmezleri

1. Prompt Library hiçbir server endpoint'i açmaz.
2. Prompt content dış ağa kendi başına gönderilmez.
3. Conversation history storage anahtarına yazılmaz.
4. Import mevcut id üzerine yazmaz.
5. Import 1 MB üstünü reddeder.
6. Collection 120 kayıtla sınırlıdır.
7. Selection 40 kayıtla sınırlıdır.
8. Prompt body 8.000 karakterle sınırlıdır.
9. Tag listesi 8 kayıtla sınırlıdır.
10. Variable listesi 12 kayıtla sınırlıdır.
11. Variable value 1.000 karakterle sınırlıdır.
12. Kopyalama başarısızsa user-visible status üretilir.
13. Prompt kullanımında auto-submit yoktur.
14. Dinamik metin DOM'da textContent/value ile işlenir.
15. PWA shell asset listesi index ile uyumlu tutulur.
16. Cache version değiştiğinde eski cache'in cleanup politikası bozulmaz.
17. MutationObserver sadece prompt card subtree'sini gözler.
18. Duplicate enhancement button eklenmez.
19. Lifecycle kapanışında observer disconnect edilir.
20. Storage read hatası uygulamayı crash ettirmez.

Bu değişmezlerden biri bozulursa ilgili test paketi ve runbook güncellenmeden release yapılmamalıdır.
