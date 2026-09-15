# Markdown rollback plan

## Tetikleyiciler

Rollback gerektiren durumlar:

- assistant mesajlarının kaybolması,
- beklenmeyen HTML execution,
- streaming sırasında sürekli DOM churn,
- PWA açılış regresyonu,
- kritik browser uyumluluk hatası.

## Birincil yöntem

İlgili PR'ı revert et.

Bu yöntem conversation storage verisini değiştirmez.

## Etkilenen yüzey

Rollback şu katmanları geri alabilir:

- message Markdown renderer,
- message renderer enhancement,
- code block tools,
- assistant message actions,
- response outline,
- ilgili PWA cache asset listesi.

## Veri

Yerel sohbet kayıtları assistant mesajının ham metnini saklar.

Markdown DOM'u kalıcı veri değildir.

Bu nedenle renderer rollback sonrasında kayıtlı yanıt plain text olarak yeniden çizilebilir.

## PWA

Rollback sonrası cache version eski sürüme döner.

Service worker eski shell asset setini kullanır.

Gerekirse tarayıcı service worker güncellemesini tetikleyecek yeni deploy yapılmalıdır.

## Doğrulama

1. Uygulamayı yeni sohbet ile aç.
2. Eski bir assistant yanıtını aç.
3. Ham metnin göründüğünü doğrula.
4. Conversation export'u kontrol et.
5. API chat stream'i test et.

## Security rollback

XSS şüphesi varsa önce renderer enhancement devre dışı bırakılır.

Ardından güvenli plain text gösterim doğrulanır.

## Geri dönüş

Düzeltilmiş renderer ayrı PR ile tekrar etkinleştirilir.

Rollback sırasında yeni feature eklenmez.

## Incident notu

Rollback PR açıklamasında olay, etkilenen browser, gözlenen payload ve doğrulama sonuçları belirtilmelidir.
