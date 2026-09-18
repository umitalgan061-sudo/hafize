# Diagnostics operasyon runbook

## Tarama
Panel açıldığında ilk tarama otomatik yapılır. Tara ile manuel yenilenebilir.

## İnceleme
Önce kayıt, duplicate ve invalid metrikleri; sonra collection/revision ilişkileri okunur.

## Güvenli repair
Normalize ve orphan budama için kullanılır. Duplicate promptlar kaybedilmez.

## Yıkıcı repair
Sadece kullanıcı kalıcı silmeyi onayladığında kullanılır.

## Recovery
Repair öncesinde recovery backup önerilir.

## Geri alma
Repair sonrasında yanlış sonuç varsa kullanıcı recovery JSON'daki prompt verisini import preview ile geri alabilir.
