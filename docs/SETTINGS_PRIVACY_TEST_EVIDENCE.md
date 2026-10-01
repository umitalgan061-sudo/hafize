# Test Kanıtı

Source contract testleri asset, DOM, lifecycle, security ve README bütünlüğünü kontrol eder.

Runtime fixture testleri gerçek privacy module'ü Node altında yükleyerek localStorage davranışını sınar.

Test senaryoları exact key, prefix key, unknown key, data/preference separation, report shape, report privacy ve scan limitlerini kapsar.

PWA gate index.html ile sw-policy'nin aynı asset'leri yüklediğini doğrular.

Final gate global clear, network primitive ve raw DOM boundary regression'larını kontrol eder.

