# Preview Tasarım Kararları

## Neden capture listener

Typed workspace zaten görev POST isteğini yönetiyor. Preview ayrı bir network katmanı kurmak yerine submit olayını capture fazında durduruyor. Bu yaklaşım API sözleşmesini ve backend güvenlik sınırlarını değiştirmiyor.

## Neden requestSubmit

Onay sonrası mevcut formun kendi submit akışı kullanılmalı. Böylece authentication, CSRF, hata kodları, response işleme ve refresh davranışı tek yerde kalıyor.

## Neden kalıcı kayıt yok

Görev metinleri hassas olabilir. Preview için ikinci bir localStorage veya sessionStorage anahtarı açmak gereksiz veri kopyası oluşturur. Dialog yalnız açık olduğu sürece form ve DOM üzerinde çalışır.

## Neden tekrar planlama form üzerinden

Duplicate eylemi ayrı bir API çağrısı olsaydı yeni bir yetki ve hata yolu doğardı. Bunun yerine güvenli row metadata'sı forma taşınır ve kullanıcı aynı preview kapısından geçirilmektedir.
