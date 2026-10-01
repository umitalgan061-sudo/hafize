# Gizlilik Merkezi Hata Modları

### localStorage unavailable

Inventory boş ve available false döner. UI kullanıcıya yerel storage'ın okunamadığını belirtmelidir.

### Partial key failure

Bir key okunamıyorsa byte ölçümü o anki erişilebilir değere göre yapılır; bütün storage'ı temizleme denenmez.

### removeItem failure

Temizleme sonucu ok false döner. Uygulama diğer alanları koşulsuz silmeye devam etmek yerine failure listesini korur.

### Clipboard unavailable

Kopyalama işlemi hata durumuna düşer; veri remote transport'a yönlendirilmez.

### Storage estimate unavailable

Usage ve quota null kalabilir. UI bunun yerine uzunluk veya byte hesaplarını kullanır.

### Report too large

Yüzey detayları sınırlı raporla daraltılır; içerik alanları rapora eklenmez.

### Destroy during refresh

Asenkron estimate sonucu panel kaldırıldıysa render yapılmaz. Destroy sonrası işlem UI'a dokunmamalıdır.
