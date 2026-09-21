# Composer Ekleri — Maintenance

## Safe edits
Limitler policy dosyasından okunur; runtime içinde ikinci bir sabit oluşturmaktan kaçınılır.

Secret scanner patternleri ayrı modülde tutulur.

UI listener'ları named handler ile bağlanırsa destroy kolaylaşır.

Yeni storage eklenmesi security review gerektirir.

Yeni network endpoint attachment kapsamına girmemelidir.

## Versioning
Static asset değişikliğinde sw-policy cache version kontrol edilir.

## Test maintenance
Her yeni davranış için en az bir source veya behavior contract testi eklenir.

## Documentation
Kullanıcı davranışını değiştiren her yeni action ilgili user guide ve release note'a eklenir.

## Compatibility
Prompt Library, Composer History ve typed runtime migration ile bağımsızlık korunur.