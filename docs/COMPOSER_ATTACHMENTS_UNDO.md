# Composer Ekleri — Undo

## Amaç
Attachment insert sonrası kullanıcıya tek adımlı geri alma sağlamak.

## Snapshot
Insert öncesinde textarea'nın before, after, selectionStart ve selectionEnd parçaları memory'de tutulur.

## Restore
Undo mevcut textarea'nın expected shape'iyle karşılaştırılır. Metin başka nedenle değişmişse körlemesine üzerine yazılmaz.

## Selection
Başarılı restore sonrası cursor önceki selection başlangıcına alınır.

## Lifetime
Undo snapshot yalnız son insert içindir ve attachment queue ile birlikte kısa ömürlüdür.

## Güvenlik
Snapshot localStorage'a yazılmaz ve network'e gönderilmez.

## UX
Undo butonu insert olmadan disabled durumdadır. Başarılı restore sonrası yeniden disabled olur.

## Failure
Güvenli koşul sağlanmıyorsa kullanıcıya geri alma yapılamadı mesajı verilir; mevcut composer korunur.