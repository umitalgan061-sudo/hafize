# Smart Fill Rollback Plan

## Kapsam

Rollback yalnız Smart Fill ve command palette UI katmanını geri almayı amaçlar. Prompt Library ana kayıtlarının silinmesi gerekmez.

## Öncelik

1. PR revert.
2. PWA cache v28 kontrolü.
3. Eski shell asset listesinin çalıştığının doğrulanması.
4. Composer'ın normal Prompt Library davranışının test edilmesi.

## Storage

Smart Fill preset anahtarları geride kalabilir; eski uygulama bunları okumadığı sürece aktif davranış oluşturmaz. Temizleme gerekiyorsa yalnız `hafize.prompt-library.smart-fill.v1.` prefix'i hedeflenmelidir.

## Veri kaybı politikası

Rollback sırasında `hafize.prompt-library.v1` silinmez ve yeniden yazılmaz. Usage verisi de ayrı bir veri akışıdır.

## Browser cache

Yeni asset'lerin service worker cache'inden çıkması için rollback commitinin cache sürümü veya shell listesi eski sürüme uyarlanmalıdır. Eski service worker'ın etkin kalması durumunda kullanıcı hard refresh yapabilir; bu bir veri silme işlemi değildir.

## Doğrulama

Rollback sonrası değişkensiz prompt, değişkenli prompt, `/prompt`, klavye kısayolu ve composer submit akışı tekrar kontrol edilir.

## Acil durum

Smart Fill bir güvenlik sorunu nedeniyle geri alınacaksa preset değerlerinin içeriği loglanmaz. Yalnızca etkilenen storage prefix'i ve release commiti kayda alınır.
