# Yanıt Regeneration Uyumluluk

## Legacy message
Eski mesajlar alternates ve generation alanı taşımayabilir. Bu durumda action bar yalnız desteklenen eylemleri gösterir.

## Local storage
Normalize katmanı geçerli mesajı alan bazında işler. Bir alanın bozuk olması tüm conversation'ı düşürmez.

## Browser
Feature modern browser API'lerine dayanır: fetch stream, localStorage, Clipboard API optional.

## Clipboard optional
Clipboard yoksa uygulama çalışmaya devam eder.

## Service worker
Response data cache kapsamına alınmaz.

## Typed build
Kaynak public/typed altında tutulur ve mevcut Vite pipeline ile derlenir.

## Legacy bridge
public/prompt-library.js gibi legacy bridge dosyalarına yeni response logic konmaz.

## Export
app-shell normalizeConversation fonksiyonu mevcut public export sözleşmesini korur; yeni alanlar backward compatible optional alanlardır.

## Deployment
Backend endpoint değişmediğinden frontend deploy tek başına feature'ı taşıyabilir; build çıktısı güncellenmelidir.

## Roll-forward
Eski conversation kayıtlarına migration commit'i gerekmez. Yeni alanlar ilk başarılı generation veya feedback işleminde oluşabilir.
