# Smart Fill Go / No-Go

## GO koşulları

- Prompt Library core API mevcut.
- Smart Fill assetleri index'te mevcut.
- Command palette assetleri index'te mevcut.
- Live hints asset'i index'te mevcut.
- Service worker shell v29.
- API yolları network-only.
- Değişkenli `Kullan` Smart Fill'e yönleniyor.
- Değişkensiz `Kullan` eski akışı koruyor.
- Composer aktarımı submit etmiyor.
- Preview text-only.
- Presetler ayrı namespace'te.
- Limitler bounded.
- Keyboard focus davranışı tanımlı.
- Rollback yolu tanımlı.

## NO-GO koşulları

- Feature remote API çağırıyorsa.
- User content HTML olarak işleniyorsa.
- Submit otomatik tetikleniyorsa.
- Index asset ile service worker asset listesi uyuşmuyorsa.
- Cache version yeni asset setinden eskiyse.
- Storage exception ana uygulamayı durduruyorsa.
- Prompt Library ana kayıt formatı gereksiz şekilde değişiyorsa.

## Kanıt

Source, security, integration, PWA, no-submit, storage isolation, browser scenario ve final contract testleri bu koşulları kaynak seviyesinde kontrol eder.

## Browser E2E

Gerçek browser E2E çalıştırılmadığında GO kararı kaynak kontratlarının geçerli olması ve bunun PR açıklamasında belirtilmesi koşuluna bağlıdır.

## Rollback

PR revert edilerek Smart Fill katmanı geri alınabilir. Ana prompt kayıtlarına dokunulmaz.
