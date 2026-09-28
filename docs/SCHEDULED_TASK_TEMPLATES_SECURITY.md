# Görev Şablonları Güvenlik

Şablonlar kullanıcı tarafından açıkça kaydedilen localStorage verisidir. Şablon modülü kendi HTTP isteğini yapmaz.

Credential ve token üretme, okuma veya saklama davranışı yoktur. Şablon adı ve görev metni DOM'a textContent veya input value ile taşınır.

Şablonu uygulamak sadece formu değiştirir. Sunucuya gönderim için kullanıcının Görevi planla submit akışı ve preview onayı gerekir.

Silme yalnız seçili şablonu etkiler. Schedule kayıtlarının ownership veya auth kararları değişmez.
