# İnceleme Notları

Privacy Center mevcut storage modeline yeni veri formatı getirmez.

Özellik özellikle "hangi veriyi tuttuğunu bilme" ihtiyacını karşılar. Raw record viewer değildir.

Unknown-key handling, üçüncü taraf veya gelecekteki feature alanlarını yanlışlıkla silme riskini azaltır.

Full cleanup için ikinci confirmation kullanılması accidental destructive action riskini azaltır.

Rapor ve summary iki farklı kullanım için ayrılır:
- JSON: machine-readable inventory.
- summary: support/hızlı paylaşım.

PWA cache yalnız UI asset'lerini kapsar.
