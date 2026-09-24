# Bağlantılar manuel test senaryoları

## Senaryo 1 — normal açılış

1. Hafize'yi aç.
2. Sol menüden Bağlantılar'ı seç.
3. Genel, Gmail, Canva ve GitHub kartlarını gözle.
4. İlk durumların yüklenmesini bekle.
5. Son yenileme metnini doğrula.

Beklenen: panel chat alanını bozmaz ve status metinleri görünür olur.

## Senaryo 2 — refresh

1. Durumları yenile düğmesine bas.
2. Aynı anda ikinci kez basmayı dene.
3. Ağ isteklerini izle.

Beklenen: eşzamanlı ikinci refresh başlamaz ve istekler GET olur.

## Senaryo 3 — Gmail bağlı

Sunucu Gmail status route'u linked=true döndürdüğünde Gmail kartı “Bağlı” göstermeli.

## Senaryo 4 — Gmail bağlı değil

linked=false döndüğünde kart “Bağlı değil” göstermeli.

## Senaryo 5 — Gmail yapılandırılmamış

GMAIL_NOT_CONFIGURED sonucu “Devre dışı” olarak görünmeli.

## Senaryo 6 — Canva bağlı

Canva status linked=true olduğunda “Bağlı” görünmeli.

## Senaryo 7 — auth

401 AUTH_REQUIRED sonucu kullanıcıya oturum gerekli mesajı göstermeli.

## Senaryo 8 — network

fetch rejection üretildiğinde UI exception fırlatmamalı.

## Senaryo 9 — timeout

AbortController timeout'ı tetiklediğinde güvenli timeout sonucu gösterilmeli.

## Senaryo 10 — collapse

Gizle düğmesi kart gövdesini kapatmalı. Göster düğmesi geri açmalı.

## Senaryo 11 — diagnostics

Tanı özeti kopyalandığında yalnız provider durumlarının özet metni panoya gitmeli.

## Senaryo 12 — mobile

Dar viewport'ta status row tek kolon olmalı.

## Senaryo 13 — keyboard

Tab ile refresh ve toggle erişilmeli.

## Senaryo 14 — workspace switch

Connections -> Chat -> Connections geçişinde kartlar tekrar görünür ve refresh tetiklenebilir olmalı.

## Senaryo 15 — destroy

Controller destroy edildiğinde dört kart ve listener'lar kaldırılmalı.

## Güvenlik gözlemi

Manuel test sırasında browser storage'da token, Authorization header veya provider raw response bulunmamalıdır.
