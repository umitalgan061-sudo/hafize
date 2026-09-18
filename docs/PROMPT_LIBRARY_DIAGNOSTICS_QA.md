# Diagnostics QA planı

## Fonksiyonel
Tarama, güvenli repair, yıkıcı repair onayı ve recovery backup eylemleri kontrol edilir.

## Veri
Duplicate id, invalid body, invalid useCount, orphan collection/revision ve capacity durumları fixture ile doğrulanır.

## Gizlilik
Analiz localStorage ile sınırlıdır. Remote telemetry bulunmaz.

## Lifecycle
Storage event sonrası tarama yenilenir. destroy sonrası listener ve panel kalıntısı bırakılmaz.

## Release gate
Diagnostics kaynak sözleşmesi, no-network ve lifecycle testleri geçmeden yayın yapılmaz.
