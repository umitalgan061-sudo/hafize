# Yanıt Varyantları Veri Modeli

## Mesaj alanları
Assistant mesajı aşağıdaki opsiyonel alanları taşır:
- alternates: en yeni önceki yanıtların listesi
- feedback: positive veya negative
- generation: model, agentId, toolsEnabled, generatedAt ve durationMs

## Normalize
Local storage okunurken alanlar yeniden normalize edilir. Geçersiz feedback atılır. Alternatifler trim, duplicate kontrolü ve üç kayıt sınırıyla temizlenir.

## Sıralama
alternates[0] en son saklanan önceki yanıttır. Restore işleminde bu kayıt aktif içerik olur ve önceki aktif içerik listenin başına alınır.

## Üretim bağlamı
Model ve ajan kimliği yalnızca UI bağlamı için saklanır. Secret veya token tutulmaz.

## Geri uyumluluk
Eski mesajlarda alanlar yoksa varsayılan davranış değişmez. Yeni alanlar opsiyoneldir.

## Kapasite
Alternatifler mesaj başına bounded kalır ve her kayıt mevcut mesaj uzunluk sınırına tabidir.

## Veri bozulması
Geçersiz bir alternatif bütün mesajı geçersiz kılmaz. Bozuk generation alanları null-safe biçimde temizlenir.

## Test ilkeleri
- malformed storage
- duplicate alternates
- max count
- max length
- rotation
- legacy messages
- generation duration normalization
- feedback normalization

## Sonuç
Model, kullanıcı ve geçmiş yanıt ilişkisi tek mesaj kaydı içinde kalır; ayrı bir remote state oluşturulmaz.
