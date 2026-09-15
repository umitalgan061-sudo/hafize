# Markdown final release checklist

## Functional

- [ ] Assistant mesajı Markdown biçiminde okunuyor.
- [ ] Plain text mesaj bozulmadan görünüyor.
- [ ] Başlıklar doğru semantic elementleri kullanıyor.
- [ ] Listeler okunabiliyor.
- [ ] Görev listesi kutuları salt okunur.
- [ ] Basit tablolar yatay taşmada sayfayı bozmuyor.
- [ ] Kod blokları kopyalanabiliyor.
- [ ] Uzun kod blokları açılıp daraltılabiliyor.
- [ ] Uzun yanıtlar daraltılabiliyor.
- [ ] Yanıt dosyaya indirilebiliyor.
- [ ] Yanıt composer alanına alıntılanabiliyor.
- [ ] Ham metin görünümü geri alınabiliyor.
- [ ] Başlık özeti uzun yanıtlarda çalışıyor.

## Preference

- [ ] Biçimlendirme varsayılan olarak açık.
- [ ] Kullanıcı tercihi localStorage'da kalıyor.
- [ ] Kapatıldığında plain text fallback oluşuyor.
- [ ] Tekrar açıldığında biçimli görünüm geri geliyor.

## Security

- [ ] Model çıktısı HTML olarak yürütülmüyor.
- [ ] Link şemaları sınırlı.
- [ ] Kod çalıştırma API'si yok.
- [ ] Clipboard yalnız kullanıcı action'ından sonra kullanılıyor.
- [ ] Download yalnız yerel Blob oluşturuyor.
- [ ] Yeni backend endpoint'i yok.
- [ ] Storage schema değişmiyor.

## Streaming

- [ ] İlk delta görünür.
- [ ] Son delta biçimli görünür.
- [ ] Aynı source gereksiz render üretmiyor.
- [ ] Renderer yüklenmesi gecikirse bounded retry çalışıyor.

## Accessibility

- [ ] Button'lar keyboard focus alıyor.
- [ ] Status mesajları duyulabilir.
- [ ] Heading semantiği korunuyor.
- [ ] List semantics korunuyor.
- [ ] Forced colors çalışıyor.
- [ ] Reduced motion ile uyumlu.

## PWA

- [ ] Renderer assetleri shell cache'te.
- [ ] Message tools assetleri shell cache'te.
- [ ] Action assetleri shell cache'te.
- [ ] Outline assetleri shell cache'te.
- [ ] Preference asseti shell cache'te.
- [ ] Cache version v36 veya daha yeni.
- [ ] API yolları mevcut policy ile network-only.

## Test

- [ ] `npm run check:markdown`
- [ ] `node scripts/test-message-markdown-suite.mjs`
- [ ] `node scripts/test-message-markdown-runtime.mjs`
- [ ] Repository syntax check

## Rollback

- [ ] PR revert yolu doğrulandı.
- [ ] Ham conversation verisinin korunacağı doğrulandı.
- [ ] Plain text fallback ile kullanıcı yanıtlarının erişilebilir kalacağı doğrulandı.
