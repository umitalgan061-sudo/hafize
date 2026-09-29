# Model ve Ajan Tercihleri Migration

## Sürüm

İlk veri sürümü 1'dir.
Ana storage anahtarı hafize.model-preferences.v1 değeridir.

## İlk kurulum

Mevcut kullanıcıda veri yoksa boş state oluşturulur.
Mevcut sohbetler değiştirilmez.
Varsayılan model ve ajan mevcut backend listelerinden gelir.

## Eski veri

Bilinmeyen veya eksik alanlar normalize edilir.
Geçersiz profiller kayda alınmaz.
Eski dizi biçimindeki export dosyaları import edilebilir.

## Gelecek sürümler

Yeni schema version eklendiğinde normalizeState öncesinde açık migration adımı eklenmelidir.
Eski profil alanları sessizce silinmemelidir.
Migration işlemi bounded olmalıdır.

## Kullanıcı etkisi

Migration otomatik network çağrısı yapmaz.
Migration konuşma geçmişine dokunmaz.
Migration başarısız olduğunda güvenli boş tercih state'i kullanılabilir.

## Geri dönüş

Yeni alanların okunamaması eski alanların kaybına yol açmamalıdır.
Export dosyası bağımsız kurtarma yolu olarak korunur.
