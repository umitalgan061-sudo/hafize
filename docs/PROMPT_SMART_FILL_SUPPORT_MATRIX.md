# Smart Fill — Destek Matrisi

| Alan | Beklenen davranış | Kontrol |
| --- | --- | --- |
| Değişken algılama | `{{ad}}` biçimlerini bulur | Regex + core sözleşmesi |
| Tekrarlı değişken | Tek alan olarak gösterilir | Set ile deduplikasyon |
| Değer sınırı | 1000 karakter | Input maxLength + clamp |
| Değişken sayısı | En fazla 12 | bounded extraction |
| Önizleme | 8000 karaktere kadar | preview count |
| Eksik değer | Aktarımı durdurur | validation message |
| Değiştir modu | Composer içeriğini değiştirir | integration test |
| Ekle modu | Composer sonuna iki satır boşlukla ekler | append test |
| Otomatik gönderim | Yapılmaz | no-submit test |
| Kullanım sayacı | Başarılı aktarımda +1 | usage test |
| Son değer | Başarılı aktarım sonrası saklanır | state test |
| Preset | En fazla 8 set | bounds test |
| Preset adı | En fazla 60 karakter | state test |
| Panoya kopyalama | Tarayıcı API'si varsa çalışır | fallback message |
| Dialog | Escape ile kapanır | accessibility |
| Odak | İlk alana taşınır | focus test |
| Odak tuzağı | Tab döngüsü panelde kalır | accessibility |
| Mobil | Tek sütun alan yerleşimi | CSS review |
| Forced colors | Canvas/Highlight kullanılır | CSS review |
| Reduced motion | Kaydırma davranışı sadeleşir | CSS review |
| Discovery | Değişken sayısı etiketi görünür | hints test |
| PWA | JS/CSS shell cache'e girer | PWA test |
| Veri kaynağı | localStorage | privacy review |
| Network | Yeni dış çağrı yok | security tests |
| HTML enjeksiyonu | Dinamik metin textContent ile yazılır | DOM safety |
| Bozuk preset | Güvenli boş listeye düşer | state normalization |
| Bozuk local storage | Ana Prompt Library etkilenmez | failure review |
| Çok uzun composer | 12000 sınırında kesilir | truncation test |
| Değişken olmayan istem | Doğrudan kullanım korunur | zero-variable test |

## Destek ilkeleri

Smart Fill ana Prompt Library kayıt formatını değiştirmez. Ek durum yalnızca Smart Fill anahtarlarında tutulur.

Kullanıcı bir değeri doldurup önizleme yapabilir; kalıcı "son değer" kaydı yalnızca aktarım başarılı olduğunda oluşur.

Preset silme yalnızca ilgili preset anahtarını etkiler. Ana prompt kaydı, kullanım sayısı ve favori durumu korunur.

PWA shell cache için Smart Fill asset'lerinin listede bulunması yeterli değildir; cache sürümünün yükseltilmiş olması da gerekir.

Bir tarayıcı Clipboard API sağlamıyorsa ana aktarım akışı etkilenmez. Kopyalama yalnızca yardımcı bir özelliktir.

Composer'a aktarım sonrasında form submit çağrılmaz. Kullanıcı gönder düğmesine ayrıca basarak normal sohbet akışını başlatır.

Güvenlik incelemesinde prompt metni, değişken değeri, preset adı ve durum mesajlarının HTML olarak yorumlanmaması temel koşuldur.

Destek ekipleri hata raporunda prompt başlığını paylaşmak zorunda değildir. Teknik inceleme için davranış, tarayıcı ve ilgili Smart Fill anahtarının varlığı yeterlidir.

Smart Fill verisinin temizlenmesi ana Prompt Library temizliği anlamına gelmez; iki veri alanı bağımsız tutulur.

