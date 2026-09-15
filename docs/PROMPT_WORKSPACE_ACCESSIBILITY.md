# Prompt Workspace — Erişilebilirlik

## Semantik

Workspace, collection, pack, workflow, batch editor ve audit yüzeyleri native button, select, input, textarea ve section/dialog elementleriyle oluşturulur.

## Dialog

Yönetim panelleri `role=dialog` ve `aria-modal=true` semantiği taşır. Başlık erişilebilir bir label ile ilişkilendirilir. Escape kapatma davranışı sağlar.

## Form alanları

Her input ve select anlamlı `aria-label` veya görünür label taşır. Dosya input'ları kullanıcıya ne yüklendiğini anlatan erişilebilir isme sahiptir.

## Durumlar

Import, export, restore, oluşturma, silme ve validation sonucu polite status region üzerinden duyurulur. Hata mesajı yalnızca renk veya icon ile verilmez.

## Klavye

Tab sırası DOM sırasını takip eder. Enter gerçek button kontrolünü çalıştırır. Escape modalı kapatabilir. Global kısayollar metin alanında yazmayı engellememelidir.

## Focus

Dialog açıldığında anlamlı ilk kontrol focus alır. Kapanınca browser'ın normal focus akışı korunur. Focus ring görünür olmalıdır.

## Mobile

Toolbar kontrolleri satır taşmasına dayanıklı flex/grid düzeninde çalışır. Dialog içerikleri dar ekranda tek sütuna düşer. Uzun prompt başlıkları wrap edilir.

## Reduced motion

Yeni özellikler animasyon bağımlı değildir. Kullanıcı reduced-motion tercih ettiğinde scroll ve geçişler anlık kalabilir.

## Forced colors

Border ve metinler sistem renklerine düşebilir. Focus outline sistem Highlight rengini kullanabilecek şekilde tanımlanır.

## Screen reader

Liste sonuçları list/listitem semantiğiyle sunulabilir. Kullanım veya pack bilgisi yalnızca görsel sayaçla sınırlı bırakılmaz; text olarak da sağlanır.

## Kullanım ilkeleri

- Renk tek başına anlam taşımaz.
- Disabled butonun nedeni yakında açıklanır.
- Uzun içerik yatay taşmaya neden olmaz.
- Kullanıcı verisi textContent ile oluşturulur.
- Clipboard veya file API başarısız olduğunda görünür durum mesajı verilir.
