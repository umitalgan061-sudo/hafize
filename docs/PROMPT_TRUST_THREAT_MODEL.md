# Prompt Trust Threat Model

## Assets

Prompt gövdeleri, başlıklar, etiketler, favori bilgisi, kullanım sayıları, collection id'leri ve seçilmiş yerel import dosyaları korunması gereken uygulama verileridir.

## Entry points

Import file input, collection selection, diagnostics repair ve bulk organizer form alanları kullanıcı kontrollü giriş noktalarıdır.

## Threat: hostile JSON

Kötü niyetli JSON aşırı büyük olabilir, beklenmeyen root type kullanabilir, yinelenen id içerebilir veya anlamsız alanlar ekleyebilir. Parser ve normalizer bu girdiyi bounded biçimde ele almalıdır.

## Threat: HTML injection

Prompt title veya body HTML etiketi içerebilir. Preview, diagnostics ve bulk UI bu değeri HTML source olarak değil text node olarak göstermelidir.

## Threat: overwrite

Import aynı id ile mevcut kayıt gönderebilir. Merge katmanı overwrite yapmamalı, yeni id oluşturmalıdır.

## Threat: storage exhaustion

Büyük import veya çok sayıda collection üyeliği tarayıcı storage'ını zorlayabilir. File, record, selection ve orphan listeleri sınırlıdır.

## Threat: stale references

Prompt silinince collection eski id'yi tutabilir. Diagnostics bunu yetim referans olarak raporlar ve kullanıcı onayı ile budar.

## Threat: accidental destructive action

Repair ve bulk işlemler kullanıcı onayını gerektiren işlemler olarak tasarlanır. Cancel ve Escape hiçbir write yapmamalıdır.

## Threat: modal confusion

Dialog odak kaybı klavye kullanıcılarının ana sayfada yanlış işlem yapmasına yol açabilir. Modal semantiği ve focus loop uygulanmalıdır.

## Threat: privacy leakage

Prompt içeriği veya diagnostics sonucu backend'e gönderilmemelidir. Yeni modüllerde fetch, XHR, WebSocket veya beacon bulunmaz.

## Mitigations

- bounded file size,
- bounded collections,
- normalized records,
- id collision protection,
- safe DOM construction,
- explicit confirmation,
- local-only storage,
- accessible dialog semantics,
- PWA shell asset isolation.

## Residual risk

Kullanıcı aynı cihazdaki localStorage içeriğine erişebilen başka yazılımlara karşı tarayıcı izolasyonuna güvenir. Bu modüller cihaz dışı şifreleme veya merkezi senkronizasyon vaat etmez.

## Review trigger

Yeni remote sync, sharing veya analytics eklenirse bu threat model yeniden değerlendirilmelidir.
