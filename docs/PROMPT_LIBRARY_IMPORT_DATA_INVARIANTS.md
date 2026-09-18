# Import data invariants

1. Mevcut prompt ID'si import ile üstüne yazılmaz.
2. Her kabul edilen yeni kayıt benzersiz ID taşır.
3. Normalize edilemeyen kayıtlar ana storage'a girmez.
4. Toplam prompt sayısı 120'yi aşmaz.
5. Apply güncel storage durumunu yeniden okur.
6. Cancel storage'ı değiştirmez.
7. Storage başarısızsa başarı mesajı verilmez.
8. Composer submit'i import katmanının sorumluluğu değildir.
