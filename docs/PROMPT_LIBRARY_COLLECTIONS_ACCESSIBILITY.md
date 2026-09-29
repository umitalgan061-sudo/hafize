# Koleksiyon Erişilebilirlik Kontrolü

Koleksiyon paneli ayrı bir section olarak isimlendirilir ve başlığı aria-labelledby ile ilişkilendirilir.

Koleksiyon filtresi açık aria-label taşır.

Toplu atama hedefi ayrı aria-label ile tanımlanır. Butonların type değeri button olarak ayarlanır; form submit tetiklenmez.

Koleksiyon listesi role=list, satırları role=listitem kullanır.

Koleksiyon yönetim editörü klavye ile çalışır. Enter isim kaydeder, Escape düzenlemeyi kapatır.

Koleksiyon filtre kısayolu Ctrl/Meta+Shift+O'dur. Kullanıcı bir input, textarea veya select içinde yazarken bu kısayol devralınmaz.

Canlı durum mesajları role=status ve aria-live=polite ile verilir.

Dynamik metinlerin tamamı textContent ile üretilir.

Mobil görünümde toolbar tek kolona düşer ve yönetim satırları okunabilir kalır.

forced-colors modunda select, input ve satır kenarlıkları sistem renklerine uyarlanır.

prefers-reduced-motion ortamında koleksiyon alt ağacında smooth scroll kullanılmaz.

Focus görünürlüğü mevcut prompt library ile aynı görsel kurala bağlanır.

Erişilebilirlik regressyon testleri aria-label, role, keyboard shortcut ve focus davranışlarını source contract düzeyinde kontrol eder.
