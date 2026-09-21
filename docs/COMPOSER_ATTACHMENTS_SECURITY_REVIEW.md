# Composer Ekleri — Security Review

## İncelenen sınırlar
Dosya girişi, filename normalization, byte validation, text normalization, binary detection, secret scan, DOM rendering, composer insertion, lifecycle ve PWA shell davranışı incelenmiştir.

## Bulgular
Byte validation readText öncesindedir.
Attachment content persistent storage'a yazılmaz.
Attachment module network API çağırmaz.
Insert kapasiteyi aşarsa composer değişmez.
Riskli içerik explicit confirm olmadan insert edilmez.
Destroy üst seviye timer ve listener'ları temizler.

## Residual risk
Secret scanner regex tabanlıdır; tam DLP değildir.
Clipboard behavior browser permission'larına bağlıdır.
Kullanıcı açıkça gönderdiğinde attachment metni normal chat payload'u olabilir.

## Review outcome
Feature boundary ile mevcut Prompt Library, Composer History ve chat runtime arasında bağımsız namespace korunur.

## Re-review trigger
Allowlist değişirse, limitler artırılırsa, storage eklenirse, upload endpoint'i gelirse veya insert submit akışına bağlanırsa yeni security review gerekir.