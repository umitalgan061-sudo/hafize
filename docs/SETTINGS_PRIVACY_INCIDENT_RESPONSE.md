# Olay Müdahalesi

Unexpected local data deletion raporunda önce Privacy Center temizleme event'i ve kullanıcı eylemi incelenir.

Raw storage içerikleri support loglarına taşınmamalıdır.

Bir surface yanlışlıkla allowlist'e girdiyse yeni kodu revert etmek storage'ı geri getirmez; kullanıcı backup'ı gerekir.

Unknown key'lerin silindiği fark edilirse bu güvenlik regression'ı olarak ele alınır.

Bir rapor raw prompt içeriyorsa release durdurulur ve rapor katmanı geri alınır.

PWA asset mismatch tek başına data incident değildir ancak cache release düzeltmesi gerekir.
