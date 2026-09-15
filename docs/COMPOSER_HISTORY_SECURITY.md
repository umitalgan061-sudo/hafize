# Composer History — Güvenlik

History verisi untrusted local input olarak ele alınır.

## Input sınırları

Kayıtlar string olmalıdır.

Null byte temizlenir.

12.000 karakterden uzun değerler kırpılır.

40 kayıttan fazlası saklanmaz.

Import 512 KB üstünde kabul edilmez.

## DOM sınırı

History metinleri DOM'a `textContent` ile yazılır.

HTML string interpolation kullanılmaz.

Kayıt başlıkları HTML olarak yorumlanmaz.

Silme düğmesinin aria label'ı bounded metinden üretilir.

Dosya adı sabittir.

`href` export linkinde runtime object URL'dir ve kullanım sonrası revoke edilir.

## Storage

Yalnız iki explicit key kullanılır.

History ve settings aynı storage alanında olsa da ayrı namespace'tedir.

Bozuk JSON empty state'e düşer.

Storage exception uygulamanın chat composer'ını durdurmamalıdır.

Storage verisi backend'e aktarılmaz.

## Yetki

History yazmak kullanıcı submit olayına bağlıdır.

External service çağrısı yoktur.

OAuth, secret, credential veya token history'de tutulmaz.

## XSS / injection

Geçmiş metni tekrar composer'a yazıldığında plain text kalır.

Panel arama sonucu yalnız text matching yapar.

Preview veya row içine executable markup sokulmaz.

Script URL, HTML fragment veya event handler üretimi yoktur.

## Privacy by design

Default local-only davranış korunur.

Retention kontrolü kullanıcıya açıktır.

Clear işleminde confirmation vardır.

Yedekleme manuel kullanıcı eylemidir.

## Regression gate

Source testlerinde network API çağrısı olmaması aranmalıdır.

DOM testleri `innerHTML`, `outerHTML` veya benzeri unsafe insertion kullanımını reddetmelidir.

PWA testleri yalnız same-origin static assetlerin shell'e girdiğini doğrulamalıdır.
