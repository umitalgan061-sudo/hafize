# Üretim Kontrolü — Güvenlik

## Tehdit modeli

Üretim kontrolü tarayıcı içinde çalışır ve güvenilmeyen model çıktısıyla aynı sayfada bulunur. Bu nedenle kontrol yüzeyi model metnini HTML olarak yorumlamaz ve tanı kayıtlarını kullanıcı içeriğinden ayırır.

## Güvenlik sınırları

Controller:

- fetch/XHR/WebSocket açmaz,
- Authorization başlığı üretmez,
- access token veya session cookie okumaz,
- prompt/response gövdesini history storage'a yazmaz,
- tanı özetine kullanıcı mesajı eklemez,
- dinamik UI metnini `textContent` ile yazar,
- hata nesnesinden yalnız bounded code değerini alır.

## Abort güvenliği

Her çalışma için yeni `AbortController` oluşturulur. Bir çalışma bittiğinde controller referansı serbest bırakılır. Geç gelen completion/failure çağrıları terminal state üzerinde etkisizdir.

Bu sayede eski bir SSE stream'inin yeni çalışmayı yanlışlıkla kapatması engellenir.

## Storage sınırları

History parser bilinmeyen kayıtları atar. Maksimum 12 kayıt, 24 KB JSON ve sabit uzunluk sınırları uygulanır. Geçersiz tarih, phase, sayaç veya metin değerleri normalize edilir.

Storage yazılamazsa UI üretimi devam eder; tanı özelliği ana chat akışını kilitlemez.

## Clipboard

Tanı özeti panoya yalnız terminal çalışmadan sonra yazılır. Clipboard API yoksa işlem başarısız kabul edilir; fallback olarak ham prompt/response kopyalanmaz.

## Klavye

Ctrl/⌘ + Shift + X yalnız üretim aktifken çalışır. Focus bir textarea/input/select/contenteditable içinde ise kısayol yakalanmaz; böylece kullanıcının yazı düzenlemesi yanlışlıkla durdurulmaz.

## XSS

Kontrol düğmeleri, geçmiş satırları ve hata metinleri `createElement` ve `textContent` ile üretilir. `innerHTML`, `outerHTML` veya kullanıcı/metin verisini HTML'e gömen string template'ler kullanılmaz.

## Privacy

Metadata-only history cihaz üzerindedir. Server analytics veya uzaktan event gönderimi yoktur. Kullanıcının prompt ve cevapları generation-control katmanı tarafından ikinci bir persistence yüzeyine çoğaltılmaz.

## Release gate

Değişikliğin release edilebilmesi için TypeScript typecheck, generation-control unit testleri, source/security contract testleri ve PWA asset kontrolünün birlikte geçmesi gerekir.
