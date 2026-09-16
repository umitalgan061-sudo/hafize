# Prompt Import Preview — QA Senaryoları

## Ön koşullar

- Prompt Library storage anahtarı kullanılabilir olmalı.
- Tarayıcı `FileReader`, `localStorage` ve temel DOM API'lerini desteklemeli.
- Test verileri gerçek kullanıcı verisi içermemeli.

## Import senaryoları

### 1. Geçerli tek kayıt
Bir JSON dizi içinde tek normalize edilebilir prompt seçilir. Önizlemede kayıt sayısı 1 görünür. Kullanıcı onaylamadan storage değişmez. Onaydan sonra kayıt eklenir.

### 2. Geçerli çoklu kayıt
Birden fazla prompt içeren dosya seçilir. Önizleme ilk birkaç başlığı güvenli metin olarak gösterir. Toplam sayı doğru görünür.

### 3. Boş dizi
`[]` seçilir. Önizleme açılabilir, ancak içe aktarma düğmesi pasif kalır. Mevcut kütüphane değişmez.

### 4. Geçersiz JSON
Bozuk JSON seçilir. Kullanıcıya hata durumu gösterilir ve storage yazılmaz.

### 5. Büyük dosya
1 MB üstü dosya seçilir. Dosya parse edilmeden reddedilir.

### 6. ID çakışması
Mevcut prompt ile aynı id'yi taşıyan kayıt bulunur. Preview çakışmayı raporlar. Onay sonrası mevcut kayıt overwrite edilmez.

### 7. Kapasite doluluğu
Kütüphane maksimum kayıt sayısına yakınken büyük import seçilir. Kullanıcı kapasite dışı kayıt sayısını görür.

## İptal senaryoları

- `Vazgeç` storage değiştirmemeli.
- Escape storage değiştirmemeli.
- Kapatma düğmesi storage değiştirmemeli.
- Backdrop tıklaması storage değiştirmemeli.

## Erişilebilirlik

Dialog başlığı erişilebilir isim sağlamalıdır. Tab dolaşımı panel içinde kalmalıdır. İlk odak anlamlı bir kontrole verilmelidir. Escape kapanışı kullanılabilir olmalıdır.

## Güvenlik

Preview verisi `textContent` ile render edilir. Kullanıcı girdisi selector, HTML veya script üretmek için kullanılmaz. Ağ çağrısı yapılmaz.

## Regression

Import preview, mevcut Export, Search, Favorite, Use ve Usage Insights yüzeyleriyle aynı storage sözleşmesini paylaşmalıdır.
