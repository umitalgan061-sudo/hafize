# Streaming Markdown yaşam döngüsü

## Akış

`app.js` SSE akışı gelen assistant delta'larını mevcut mesaj düğümünün textContent'ine yazar.

Markdown enhancement bu değişikliği MutationObserver ile algılar.

Render yalnız assistant mesajlarının `.content` alanında yapılır.

Kullanıcı mesajları plain text olarak kalır.

## İlk render

Renderer globali henüz hazır değilse enhancement bounded retry uygular.

Retry aralığı artan gecikmeyle en fazla 12 kez denenir.

Bu mekanizma uygulama event loop'unu sonsuz timer ile meşgul etmez.

## Delta render

Her delta sonrası yeni kaynak metin alınır.

Önceki kaynak `data-markdown-source` ile karşılaştırılır.

Aynı kaynak tekrar geldiyse DOM yeniden kurulmaz.

Yeni kaynak geldiğinde mevcut content children güvenli şekilde değiştirilir.

## Kod blokları

Tamamlanmamış çitli kod blokları sırasında parser mevcut metni güvenli paragraf veya text düğümleri olarak gösterebilir.

Kapanış fence geldiğinde sonraki observer turunda gerçek `pre > code` sunumu oluşur.

Kod araçları ayrıca `pre` elementlerini gözlemler.

## Scroll

Markdown katmanı scroll yönetmez.

Ana uygulamanın mesaj akışı scroll politikasına müdahale edilmez.

## Performans sınırları

Mesaj başına 24.000 karakter parse edilir.

Blok sayısı 240 ile sınırlıdır.

Satır uzunluğu 1.200 karakterle bounded'dır.

## Hata izolasyonu

Renderer hata verirse enhancement'ın kendi callback'i UI'ı durdurmamalıdır.

Clipboard hatası yalnız kod kontrolünün status alanına yazılır.

## Test matrisi

- kısa plain text,
- başlık delta'sı,
- code fence başlangıcı,
- code fence kapanışı,
- uzun response sınırı,
- tekrarlı aynı kaynak,
- renderer gecikmesi,
- mesaj listesi yeniden çizimi

kontrol edilmelidir.
