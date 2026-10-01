# Performans

Inventory O(n) anahtar taraması yapar ve n en fazla 300'dür. Her key için yalnız getItem okunur.

Yüzey listesi render sırasında bounded filtreleme yapar. Search kutusu query'yi 80 karakterle sınırlar.

Storage estimate asynchronous olduğu için UI ilk olarak temel inventory ile çizilir; estimate tamamlandığında yeniden boyanır.

MutationObserver kullanılmaz. Panelin kendi action listener'ları doğrudan kaydedilir ve destroy sırasında kaldırılır.

Rapor 120 KB ile sınırlandırılmıştır. Yüzey listesi ihtiyaç halinde daraltılır.

Storage kullanım oranı yalnız estimate destekleniyorsa hesaplanır.

Büyük localStorage değerlerinin tamamını ekrana taşımamak kritik performans ve privacy kararındandır.
