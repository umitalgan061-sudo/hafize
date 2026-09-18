# Diagnostics destek notları

## Okuma hatası
Prompt storage parse edilemiyorsa otomatik repair engellenir.

## Duplicate
Duplicate ID sayısı yükseliyorsa recovery backup alın ve sonra güvenli repair çalıştırın.

## Orphan
Collection/revision orphanları mevcut olmayan prompt ID'lerini işaret eder.

## Çok yüksek orphan
240 üstünde otomatik repair deliberately durur.

## Yanlış repair
Son onarımı geri al kullanın. Yoksa recovery snapshot ile prompt verisini yeniden içe aktarın.
